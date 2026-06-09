import "./style.css";
import { WSManager } from "./WSManager";
import { Engine } from "./Engine";
import { Widget } from "./Widget";
import type { Trade, TradeSubscriber } from "./types";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div style="width: 100vw; height: 100vh; overflow: hidden; position: relative; background: #0a0a0c;">
    <canvas id="main-canvas" style="display: block; position: absolute; z-index: 1;"></canvas>
    
    <!-- Transparent UI layer for scrolling overlay divs -->
    <div id="ui-layer" style="position: absolute; top: 0; left: 0; pointer-events: none; width: 100%; height: 100%; z-index: 2;"></div>
    
    <!-- Top HUD for adding widgets -->
    <div style="position: absolute; top: 20px; right: 20px; z-index: 10; display: flex; gap: 10px;">
      <div id="widget-counter" style="color: #8b8b9e; font-family: Inter, sans-serif; font-size: 14px; line-height: 36px;">0 / 50 Widgets</div>
      <button id="add-widget-btn" style="background: #00e676; color: #0a0a0c; border: none; padding: 0 16px; border-radius: 6px; font-weight: 600; cursor: pointer; height: 36px; font-family: Inter, sans-serif; box-shadow: 0 4px 12px rgba(0, 230, 118, 0.3);">+ Add Widget</button>
    </div>

    <!-- Top left performance HUD -->
    <div style="position: absolute; top: 20px; left: 20px; z-index: 10; display: flex; flex-direction: column; gap: 4px; background: rgba(30, 30, 35, 0.85); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.1); backdrop-filter: blur(8px);">
      <div id="fps-counter" style="color: #00e676; font-family: 'JetBrains Mono', monospace, sans-serif; font-size: 13px; font-weight: bold;">FPS: --</div>
      <div id="mem-counter" style="color: #8b8b9e; font-family: 'JetBrains Mono', monospace, sans-serif; font-size: 12px;">Mem: -- MB</div>
      <div id="data-counter" style="color: #8b8b9e; font-family: 'JetBrains Mono', monospace, sans-serif; font-size: 12px;">Data: 0 KB</div>
    </div>

    <!-- Dropdowns (Hidden by default) -->
    <div id="symbol-dropdown" class="dropdown" style="display: none; position: absolute; z-index: 20; background: #1e1e25; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 4px; max-height: 250px; overflow-y: auto; box-shadow: 0 8px 16px rgba(0,0,0,0.5);">
      <!-- Options injected by JS -->
    </div>

    <div id="filter-dropdown" class="dropdown" style="display: none; position: absolute; z-index: 20; background: #1e1e25; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 4px; box-shadow: 0 8px 16px rgba(0,0,0,0.5);">
      <div class="dropdown-item" data-val="0">ALL</div>
      <div class="dropdown-item" data-val="1">BUY</div>
      <div class="dropdown-item" data-val="2">SELL</div>
    </div>
  </div>
`;

const wsManager = new WSManager("ws://localhost:8080");
const engine = new Engine("main-canvas", "ui-layer");
engine.setWSManager(wsManager);

const addWidgetBtn = document.getElementById("add-widget-btn")!;
const widgetCounter = document.getElementById("widget-counter")!;
const symbolDropdown = document.getElementById("symbol-dropdown")!;
const filterDropdown = document.getElementById("filter-dropdown")!;

const widgetHandlers = new Map<Widget, TradeSubscriber>();

// Generate 100 symbols for the dropdown to match the server mock
const baseCoins = [
  "BTC",
  "ETH",
  "USDT",
  "BNB",
  "XRP",
  "SOL",
  "ADA",
  "DOGE",
  "TRX",
  "LINK"
];
let dropdownHtml = "";
for (let i = 0; i < 100; i++) {
  const symbol = i < baseCoins.length ? `${baseCoins[i]}/IDR` : `COIN${i}/IDR`;
  dropdownHtml += `<div class="dropdown-item" data-id="${i}">${symbol}</div>`;
}
symbolDropdown.innerHTML = dropdownHtml;

let activeTargetWidget: Widget | null = null;

// Handle Add Widget
addWidgetBtn.addEventListener("click", () => {
  const widgets = engine.getWidgets();
  if (widgets.length >= 50) return;

  // Random default symbol from the top 10
  const defaultSymbolId = Math.floor(Math.random() * 10);

  // Stagger creation position
  const x = 50 + ((widgets.length * 30) % 300);
  const y = 50 + ((widgets.length * 30) % 300);

  const w = new Widget(defaultSymbolId, x, y);

  // Create a bound trade handler attached to the widget so we can unsubscribe correctly later
  const handler = (trade: Trade) => w.addTrade(trade);
  widgetHandlers.set(w, handler);

  engine.addWidget(w);
  wsManager.subscribe(w.symbolId, handler);

  widgetCounter.innerText = `${engine.getWidgets().length} / 50 Widgets`;
});

// Hide dropdowns when clicking anywhere outside them
window.addEventListener("mousedown", e => {
  if (!(e.target as HTMLElement).closest(".dropdown")) {
    symbolDropdown.style.display = "none";
    filterDropdown.style.display = "none";
  }
});

// Engine Callbacks to show Dropdowns
engine.onSymbolClick = (widget, x, y) => {
  activeTargetWidget = widget;
  symbolDropdown.style.left = `${x}px`;
  symbolDropdown.style.top = `${y + 20}px`;
  symbolDropdown.style.display = "block";
  filterDropdown.style.display = "none";
};

engine.onFilterClick = (widget, x, y) => {
  activeTargetWidget = widget;
  filterDropdown.style.left = `${x - 60}px`;
  filterDropdown.style.top = `${y + 20}px`;
  filterDropdown.style.display = "block";
  symbolDropdown.style.display = "none";
};

// Handle Dropdown selections
symbolDropdown.addEventListener("mousedown", e => {
  const target = e.target as HTMLElement;
  if (target.classList.contains("dropdown-item") && activeTargetWidget) {
    const newId = parseInt(target.getAttribute("data-id")!, 10);

    if (activeTargetWidget.symbolId !== newId) {
      const oldHandler = widgetHandlers.get(activeTargetWidget);
      if (oldHandler) {
        // Unsubscribe old
        wsManager.unsubscribe(activeTargetWidget.symbolId, oldHandler);

        // Clear trades & scroll to top
        activeTargetWidget.trades = [];
        activeTargetWidget.scrollY = 0;

        // Subscribe new
        activeTargetWidget.symbolId = newId;
        wsManager.subscribe(newId, oldHandler);
      }
    }
    symbolDropdown.style.display = "none";
  }
});

filterDropdown.addEventListener("mousedown", e => {
  const target = e.target as HTMLElement;
  if (target.classList.contains("dropdown-item") && activeTargetWidget) {
    const val = parseInt(target.getAttribute("data-val")!, 10);
    activeTargetWidget.filter = val;

    // Clear existing trades to strictly enforce the visual filter immediately
    activeTargetWidget.trades = [];
    activeTargetWidget.scrollY = 0;

    filterDropdown.style.display = "none";
  }
});
