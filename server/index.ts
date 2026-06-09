import { WebSocketServer, WebSocket } from 'ws';

const port = 8080;
const wss = new WebSocketServer({ port });

// --- 6. Binary Protocol Mapping ---
// Map pairs to uint16 IDs to save bandwidth
export const SYMBOL_MAP: Record<string, number> = {
  'BTC/IDR': 0,
  'ETH/IDR': 1,
  'USDT/IDR': 2,
  'BNB/IDR': 3,
  'XRP/IDR': 4,
};
const SYMBOL_KEYS = Object.keys(SYMBOL_MAP);

// --- 7. Mock Trade Generator ---
function generateMockTrades() {
  const numTrades = Math.floor(Math.random() * 20); // 0-20 trades per tick
  const trades = [];
  
  for (let i = 0; i < numTrades; i++) {
    const symbolString = SYMBOL_KEYS[Math.floor(Math.random() * SYMBOL_KEYS.length)];
    const symbolId = SYMBOL_MAP[symbolString];
    
    trades.push({
      symbolId,
      price: Math.random() * 1000000000,
      amount: Math.random() * 10,
      side: Math.random() > 0.5 ? 1 : 0, // 1 = SELL, 0 = BUY
    });
  }
  return trades;
}

// --- 8. 100ms Throttle Interval & Binary Packing ---
// 2 bytes (uint16 symbol) + 8 bytes (float64 price) + 8 bytes (float64 amount) + 1 byte (uint8 side) = 19 bytes per trade
const TRADE_BYTE_SIZE = 19; 

setInterval(() => {
  const trades = generateMockTrades();
  
  // Don't broadcast if no trades or no clients
  if (trades.length === 0 || wss.clients.size === 0) return;

  const buffer = Buffer.alloc(trades.length * TRADE_BYTE_SIZE);
  let offset = 0;

  for (const trade of trades) {
    buffer.writeUInt16LE(trade.symbolId, offset);
    offset += 2;
    buffer.writeDoubleLE(trade.price, offset);
    offset += 8;
    buffer.writeDoubleLE(trade.amount, offset);
    offset += 8;
    buffer.writeUInt8(trade.side, offset);
    offset += 1;
  }

  // Broadcast binary buffer to all connected clients
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(buffer);
    }
  });
}, 100);

// --- 9. Server-side Heartbeat ---
wss.on('connection', (ws: WebSocket) => {
  console.log('Client connected');
  
  let pongTimeout: NodeJS.Timeout;

  ws.on('pong', () => {
    clearTimeout(pongTimeout);
  });

  // Ping every 10 seconds
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
      
      // If no pong received within 3 seconds, terminate connection
      pongTimeout = setTimeout(() => {
        console.log('Terminating unresponsive client');
        ws.terminate();
      }, 3000);
    }
  }, 10000);

  ws.on('close', () => {
    console.log('Client disconnected');
    clearInterval(pingInterval);
    clearTimeout(pongTimeout);
  });
});

console.log(`WebSocket server running on ws://localhost:${port}`);
