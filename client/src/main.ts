import './style.css';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <h1>Crypto Live Trade Terminal</h1>
    <p id="status">Connecting to server...</p>
    <div id="messages"></div>
  </div>
`;

const statusEl = document.getElementById('status')!;
const messagesEl = document.getElementById('messages')!;

const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
  statusEl.innerText = 'Connected to server';
  ws.send('Hello from Client!');
};

ws.onmessage = (event) => {
  const p = document.createElement('p');
  p.innerText = `Received: ${event.data}`;
  messagesEl.appendChild(p);
};

ws.onclose = () => {
  statusEl.innerText = 'Disconnected from server';
};
