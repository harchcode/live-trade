import './style.css';
import { WSManager } from './WSManager';
import { Engine } from './Engine';
import { Widget } from './Widget';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div style="width: 100vw; height: 100vh; overflow: hidden; position: relative;">
    <canvas id="main-canvas" style="display: block;"></canvas>
    <div id="ui-layer" style="position: absolute; top: 0; left: 0; pointer-events: none; width: 100%; height: 100%;"></div>
  </div>
`;

// Adjust styles for full screen premium look
document.body.style.margin = '0';
document.body.style.padding = '0';
document.body.style.background = '#0a0a0c';
document.body.style.fontFamily = 'Inter, sans-serif';

const wsManager = new WSManager('ws://localhost:8080');
const engine = new Engine('main-canvas');

// Instantiate testing widgets
const w1 = new Widget(0, 50, 50); // BTC/IDR (Symbol ID 0)
const w2 = new Widget(1, 420, 100); // ETH/IDR (Symbol ID 1)

engine.addWidget(w1);
engine.addWidget(w2);

// Hook widgets to WS manager
wsManager.subscribe(w1.symbolId, (trade) => w1.addTrade(trade));
wsManager.subscribe(w2.symbolId, (trade) => w2.addTrade(trade));
