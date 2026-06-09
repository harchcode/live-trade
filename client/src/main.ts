import './style.css';
import { WSManager } from './WSManager';
import type { Trade } from './types';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <h1>Crypto Live Trade Terminal</h1>
    <p id="status">Connecting...</p>
    <div id="messages" style="height: 300px; overflow-y: auto; background: #111; color: #0f0; padding: 10px; font-family: monospace;"></div>
  </div>
`;

const wsManager = new WSManager('ws://localhost:8080');

// Just for testing phase 2: Subscribe to a few symbols and log them
const messagesEl = document.getElementById('messages')!;

function onTradeReceived(trade: Trade) {
  const p = document.createElement('div');
  p.innerText = `[${new Date(Number(trade.timestamp)).toISOString()}] Symbol: ${trade.symbolId} | Side: ${trade.side === 1 ? 'SELL' : 'BUY'} | Price: ${trade.price.toFixed(2)} | Amount: ${trade.amount.toFixed(4)}`;
  messagesEl.appendChild(p);

  // Keep only the last 50 logs so it doesn't crash the DOM
  if (messagesEl.childNodes.length > 50) {
    messagesEl.removeChild(messagesEl.firstChild!);
  }

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Subscribing after a slight delay to ensure connection is open
// In a real app, the WSManager handles queueing subscriptions, but here it's fine.
setTimeout(() => {
  document.getElementById('status')!.innerText =
    'Connected! Subscribed to BTC/IDR (0) and ETH/IDR (1)';
  wsManager.subscribe(0, onTradeReceived);
  wsManager.subscribe(1, onTradeReceived);
}, 500);
