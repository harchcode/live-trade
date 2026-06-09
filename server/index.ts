import { WebSocketServer, WebSocket } from 'ws';

const port = 8080;
const wss = new WebSocketServer({ port });

// --- 6. 100+ Symbol Mapping ---
export const SYMBOL_MAP: Record<string, number> = {};
const SYMBOL_KEYS: string[] = [];

// Generate 100 dummy symbols (e.g., BTC/IDR, ETH/IDR, COIN1/IDR ... COIN98/IDR)
const baseCoins = ['BTC', 'ETH', 'USDT', 'BNB', 'XRP', 'SOL', 'ADA', 'DOGE', 'TRX', 'LINK'];
for (let i = 0; i < 100; i++) {
  const symbol = i < baseCoins.length ? `${baseCoins[i]}/IDR` : `COIN${i}/IDR`;
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
    activeSubscriptions.set(symbolId, (activeSubscriptions.get(symbolId) || 0) + 1);
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

// --- 9. Asynchronous Data Generation (20ms) ---
interface Trade {
  timestamp: bigint; // uint64
  symbolId: number; // uint16
  side: number; // uint8
  price: number; // float64
  amount: number; // float64
}

const tradeQueue: Trade[] = [];

setInterval(() => {
  // Only generate if there are clients and active subscriptions
  if (wss.clients.size === 0 || activeSubscriptions.size === 0) return;

  const activeSymbolIds = Array.from(activeSubscriptions.keys());

  // Randomly pick a few active symbols to generate trades for
  const numTrades = Math.floor(Math.random() * 5); // 0-4 trades per 20ms tick

  for (let i = 0; i < numTrades; i++) {
    const symbolId = activeSymbolIds[Math.floor(Math.random() * activeSymbolIds.length)];
    tradeQueue.push({
      timestamp: BigInt(Date.now()),
      symbolId,
      side: Math.random() > 0.5 ? 1 : 0, // 1 = SELL, 0 = BUY
      price: Math.random() * 1000000000,
      amount: Math.random() * 10,
    });
  }
}, 20);

// --- 10. Throttle Interval & Binary Packing (100ms) ---
const TRADE_BYTE_SIZE = 27; // 8 + 2 + 1 + 8 + 8 bytes

setInterval(() => {
  if (tradeQueue.length === 0 || wss.clients.size === 0) return;

  const tradesToProcess = tradeQueue.splice(0, 500);

  wss.clients.forEach((client) => {
    const extClient = client as ExtWebSocket;
    if (extClient.readyState !== WebSocket.OPEN) return;

    // Filter trades for this specific client's subscriptions
    const clientTrades = tradesToProcess.filter((t) => extClient.subscriptions.has(t.symbolId));

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
}, 100);

// --- 11. Server-side Heartbeat & Connection Handling ---
wss.on('connection', (ws: ExtWebSocket) => {
  console.log('Client connected');
  ws.isAlive = true;
  ws.subscriptions = new Set();

  let pongTimeout: NodeJS.Timeout;

  ws.on('pong', () => {
    clearTimeout(pongTimeout);
  });

  ws.on('message', (message) => {
    // Expected binary message: [Action (1 byte), SymbolID (2 bytes)]
    // Action: 0 = Subscribe, 1 = Unsubscribe
    if (Buffer.isBuffer(message) && message.length >= 3) {
      const action = message.readUInt8(0);
      const symbolId = message.readUInt16LE(1);

      if (action === 0) {
        addSubscription(ws, symbolId);
        console.log(`Client subscribed to ${symbolId}`);
      } else if (action === 1) {
        removeSubscription(ws, symbolId);
        console.log(`Client unsubscribed from ${symbolId}`);
      }
    }
  });

  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
      pongTimeout = setTimeout(() => {
        console.log('Terminating unresponsive client');
        ws.terminate();
      }, 3000);
    }
  }, 10000);

  ws.on('close', () => {
    console.log('Client disconnected');
    handleClientDisconnect(ws);
    clearInterval(pingInterval);
    clearTimeout(pongTimeout);
  });
});

console.log(`WebSocket server running on ws://localhost:${port}`);
