import { WebSocketServer } from 'ws';

const port = 8080;
const wss = new WebSocketServer({ port });

wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.send('Hello from WebSocket Server!');

  ws.on('message', (message) => {
    console.log('Received:', message.toString());
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

console.log(`WebSocket server is running on ws://localhost:${port}`);
