import { WebSocketServer, WebSocket } from "ws";
import { APP_CONFIG, getSymbolName } from "../shared/constants";

// --- Configuration ---
const CONFIG = {
  PORT: 8080,
  DATA_GEN_INTERVAL_MS: 50,
  THROTTLE_INTERVAL_MS: 100,
  MIN_TRADES_PER_TICK: 5,
  MAX_TRADES_PER_TICK: 50,
  MAX_TRADES_PER_BATCH: 500, // max trades to send per 100ms tick
  PING_INTERVAL_MS: 10000,
  PONG_TIMEOUT_MS: 3000,
  NUM_SYMBOLS: 50
};

const wss = new WebSocketServer({ port: CONFIG.PORT });

// --- 6. Symbol Mapping ---
export const SYMBOL_MAP: Record<string, number> = {};
export const SYMBOL_KEYS: string[] = [];

for (let i = 0; i < CONFIG.NUM_SYMBOLS; i++) {
  const symbol = getSymbolName(i);
  SYMBOL_MAP[symbol] = i;
  SYMBOL_KEYS.push(symbol);
}

// --- 7 & 8. Pub/Sub State Tracking ---
interface ExtWebSocket extends WebSocket {
  isAlive: boolean;
  subscriptions: Set<number>;
}

// Global set of all currently active subscriptions across all clients
// Map<SymbolID, NumberOfSubscribers>
const activeSubscriptions = new Map<number, number>();

function addSubscription(ws: ExtWebSocket, symbolId: number) {
  if (!ws.subscriptions.has(symbolId)) {
    ws.subscriptions.add(symbolId);
    activeSubscriptions.set(
      symbolId,
      (activeSubscriptions.get(symbolId) || 0) + 1
    );
  }
}

function removeSubscription(ws: ExtWebSocket, symbolId: number) {
  if (ws.subscriptions.has(symbolId)) {
    ws.subscriptions.delete(symbolId);
    const currentCount = activeSubscriptions.get(symbolId) || 0;
    if (currentCount <= 1) {
      activeSubscriptions.delete(symbolId);
    } else {
      activeSubscriptions.set(symbolId, currentCount - 1);
    }
  }
}

function handleClientDisconnect(ws: ExtWebSocket) {
  for (const symbolId of ws.subscriptions) {
    removeSubscription(ws, symbolId);
  }
}

// --- 9. Asynchronous Data Generation ---
interface Trade {
  timestamp: bigint; // uint64
  symbolId: number; // uint16
  side: number; // uint8
  price: number; // float64
  amount: number; // float64
}

const tradeQueue: Trade[] = [];

setInterval(() => {
  if (wss.clients.size === 0 || activeSubscriptions.size === 0) return;

  // Global market activity: random number of trades occur across the entire exchange per tick
  const range = CONFIG.MAX_TRADES_PER_TICK - CONFIG.MIN_TRADES_PER_TICK + 1;
  const totalTradesThisTick =
    Math.floor(Math.random() * range) + CONFIG.MIN_TRADES_PER_TICK;

  for (let i = 0; i < totalTradesThisTick; i++) {
    const symbolId = Math.floor(Math.random() * CONFIG.NUM_SYMBOLS);

    // Optimization: Skip allocating memory for this trade if nobody is listening to it specifically AND nobody is listening to the wildcard (65535)
    if (
      !activeSubscriptions.has(symbolId) &&
      !activeSubscriptions.has(APP_CONFIG.WILDCARD_SYMBOL_ID)
    )
      continue;

    tradeQueue.push({
      timestamp: BigInt(Date.now()),
      symbolId,
      side: Math.random() > 0.5 ? 1 : 0, // 1 = SELL, 0 = BUY
      price: Math.random() * 1000000000,
      amount: Math.random() * 10
    });
  }
}, CONFIG.DATA_GEN_INTERVAL_MS);

// --- 10. Throttle Interval & Binary Packing ---
const TRADE_BYTE_SIZE = 27; // 8 + 2 + 1 + 8 + 8 bytes

setInterval(() => {
  if (tradeQueue.length === 0 || wss.clients.size === 0) return;

  const tradesToProcess = tradeQueue.splice(0, CONFIG.MAX_TRADES_PER_BATCH);

  wss.clients.forEach(client => {
    const extClient = client as ExtWebSocket;
    if (extClient.readyState !== WebSocket.OPEN) return;

    // Filter trades for this specific client's subscriptions, or clients subscribed to ALL (65535)
    const clientTrades = tradesToProcess.filter(
      t =>
        extClient.subscriptions.has(t.symbolId) ||
        extClient.subscriptions.has(APP_CONFIG.WILDCARD_SYMBOL_ID)
    );

    if (clientTrades.length === 0) return;

    const buffer = Buffer.alloc(clientTrades.length * TRADE_BYTE_SIZE);
    let offset = 0;

    for (const trade of clientTrades) {
      buffer.writeBigUInt64LE(trade.timestamp, offset);
      offset += 8;
      buffer.writeUInt16LE(trade.symbolId, offset);
      offset += 2;
      buffer.writeUInt8(trade.side, offset);
      offset += 1;
      buffer.writeDoubleLE(trade.price, offset);
      offset += 8;
      buffer.writeDoubleLE(trade.amount, offset);
      offset += 8;
    }

    extClient.send(buffer);
  });
}, CONFIG.THROTTLE_INTERVAL_MS);

// --- 11. Server-side Heartbeat & Connection Handling ---
wss.on("connection", (ws: ExtWebSocket) => {
  console.log("Client connected");
  ws.isAlive = true;
  ws.subscriptions = new Set();

  let pongTimeout: NodeJS.Timeout;

  ws.on("pong", () => {
    clearTimeout(pongTimeout);
  });

  ws.on("message", message => {
    // Expected binary message: [Action (1 byte), SymbolID (2 bytes)]
    // Action: 0 = Subscribe, 1 = Unsubscribe, 2 = Ping
    if (Buffer.isBuffer(message) && message.length >= 1) {
      const action = message.readUInt8(0);

      if (action === 2) {
        // Client manual ping, send manual pong (Action 3)
        const pongBuf = Buffer.alloc(1);
        pongBuf.writeUInt8(3, 0);
        ws.send(pongBuf);
        return;
      }

      if (message.length >= 3) {
        const symbolId = message.readUInt16LE(1);
        if (action === 0) {
          addSubscription(ws, symbolId);
          console.log(`Client subscribed to ${symbolId}`);
        } else if (action === 1) {
          removeSubscription(ws, symbolId);
          console.log(`Client unsubscribed from ${symbolId}`);
        }
      }
    }
  });

  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
      pongTimeout = setTimeout(() => {
        console.log("Terminating unresponsive client");
        ws.terminate();
      }, CONFIG.PONG_TIMEOUT_MS);
    }
  }, CONFIG.PING_INTERVAL_MS);

  ws.on("close", () => {
    console.log("Client disconnected");
    handleClientDisconnect(ws);
    clearInterval(pingInterval);
    clearTimeout(pongTimeout);
  });
});

console.log(`WebSocket server running on ws://localhost:${CONFIG.PORT}`);
