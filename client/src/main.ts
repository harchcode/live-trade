import "./style.css";
import { WSManager } from "./WSManager";
import { Engine } from "./Engine";
import { Widget } from "./Widget";
import { APP_CONFIG, WIDGET_LAYOUT } from "./constants";
import type { Trade, TradeSubscriber } from "./types";
import { getSymbolName } from "./types";
import { applyThemeToDOM, toggleTheme } from "./theme";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow: hidden; background: var(--bg-color, #0f0f13);">
    <style>
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
    <canvas id="main-canvas" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1;"></canvas>
    
    <!-- Transparent UI layer for scrolling overlay divs -->
    <div id="ui-layer" style="position: absolute; top: 0; left: 0; pointer-events: none; width: 100%; height: 100%; z-index: 2;"></div>
    
    <!-- Top HUD for adding widgets -->
    <div style="position: absolute; top: 20px; right: 20px; z-index: 10; display: flex; gap: 10px;">
      <button id="theme-toggle-btn" style="background: var(--hud-bg, rgba(30, 30, 35, 0.85)); color: var(--text-primary, #fff); border: 1px solid var(--border, rgba(255, 255, 255, 0.1)); padding: 0 12px; border-radius: 6px; cursor: pointer; height: 36px; font-family: Inter, sans-serif; backdrop-filter: blur(8px);">Toggle Theme</button>
      <div id="widget-counter" style="color: var(--text-secondary, #8b8b9e); font-family: Inter, sans-serif; font-size: 14px; line-height: 36px;">0 / 50 Widgets</div>
      <button id="remove-all-btn" style="background: var(--hud-bg, rgba(30, 30, 35, 0.85)); color: var(--color-sell, #ff1744); border: 1px solid var(--border, rgba(255, 255, 255, 0.1)); padding: 0 16px; border-radius: 6px; font-weight: 600; cursor: pointer; height: 36px; font-family: Inter, sans-serif; backdrop-filter: blur(8px);">Remove All</button>
      <button id="fill-widgets-btn" style="background: var(--hud-bg, rgba(30, 30, 35, 0.85)); color: var(--color-buy, #00e676); border: 1px solid var(--border, rgba(255, 255, 255, 0.1)); padding: 0 16px; border-radius: 6px; font-weight: 600; cursor: pointer; height: 36px; font-family: Inter, sans-serif; backdrop-filter: blur(8px);">Fill 50</button>
      <button id="add-widget-btn" style="background: #00e676; color: #0a0a0c; border: none; padding: 0 16px; border-radius: 6px; font-weight: 600; cursor: pointer; height: 36px; font-family: Inter, sans-serif; box-shadow: 0 4px 12px rgba(0, 230, 118, 0.3);">+ Add Widget</button>
    </div>

    <!-- Top left performance HUD -->
    <div style="position: absolute; top: 20px; left: 20px; z-index: 10; display: flex; gap: 15px; align-items: center; height: 36px;">
      <div id="ws-status" style="color: var(--color-sell, #ff1744); font-family: Inter, sans-serif; font-size: 14px; font-weight: 600;">🔴 Connecting...</div>
      <div id="fps-counter" style="color: var(--color-buy, #00e676); font-family: 'JetBrains Mono', monospace, sans-serif; font-size: 13px; font-weight: bold;">FPS: --</div>
      <div id="trade-counter" style="color: var(--text-secondary, #8b8b9e); font-family: 'JetBrains Mono', monospace, sans-serif; font-size: 13px;">Trades/s: 0</div>
      <div id="mem-counter" style="color: var(--text-secondary, #8b8b9e); font-family: 'JetBrains Mono', monospace, sans-serif; font-size: 13px;">Mem: -- MB</div>
      <div id="data-counter" style="color: var(--text-secondary, #8b8b9e); font-family: 'JetBrains Mono', monospace, sans-serif; font-size: 13px; transition: color 0.3s ease;">Data: 0 KB/s</div>
    </div>

    <!-- Bottom right footer -->
    <div style="position: absolute; bottom: 20px; right: 20px; z-index: 10;">
      <a href="https://github.com/harchcode/live-trade" target="_blank" style="color: var(--text-secondary, #8b8b9e); font-family: Inter, sans-serif; font-size: 13px; text-decoration: none; display: flex; align-items: center; gap: 8px; padding: 6px 12px; background: var(--hud-bg, rgba(30, 30, 35, 0.85)); border-radius: 6px; border: 1px solid var(--border, rgba(255, 255, 255, 0.1)); backdrop-filter: blur(8px);">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
        </svg>
        View on GitHub
      </a>
    </div>

    <!-- Server Boot Warning -->
    <div id="server-boot-warning" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--hud-bg, rgba(30, 30, 35, 0.9)); border: 1px solid var(--border, rgba(255,255,255,0.1)); padding: 25px 40px; border-radius: 16px; color: var(--text-primary, #fff); font-family: Inter, sans-serif; text-align: center; z-index: 1000; backdrop-filter: blur(16px); box-shadow: 0 20px 50px rgba(0,0,0,0.5); display: flex; flex-direction: column; align-items: center; gap: 15px;">
      <div style="width: 32px; height: 32px; border: 3px solid var(--border, rgba(255,255,255,0.1)); border-top-color: var(--color-buy, #00e676); border-radius: 50%; animation: spin 1s linear infinite;"></div>
      <div style="font-weight: 600; font-size: 18px;">☕ Waking up the server...</div>
      <div style="color: var(--text-secondary, #8b8b9e); font-size: 14px; line-height: 1.5;">I am cheap, I use a free server, so it needs ~60 seconds to boot up! 😅<br/>Please be patient!</div>
    </div>

    <!-- Dropdowns (Hidden by default) -->
    <div id="symbol-dropdown" class="dropdown" style="display: none; position: absolute; z-index: 20; background: var(--dropdown-bg, #1e1e25); border: 1px solid var(--border, rgba(255,255,255,0.1)); border-radius: 6px; padding: 4px; max-height: 250px; overflow-y: auto; box-shadow: 0 8px 16px var(--shadow, rgba(0,0,0,0.5));">
      <!-- Options injected by JS -->
    </div>
  </div>
`;

applyThemeToDOM();
document
  .getElementById("theme-toggle-btn")!
  .addEventListener("click", toggleTheme);

const wsManager = new WSManager(APP_CONFIG.WS_URL);
const engine = new Engine("main-canvas", "ui-layer");
engine.setWSManager(wsManager);

const wsStatus = document.getElementById("ws-status")!;
const bootWarning = document.getElementById("server-boot-warning")!;

let hasConnectedOnce = false;

wsManager.onStatusChange = status => {
  if (status === "connected") {
    hasConnectedOnce = true;
    wsStatus.innerText = "🟢 Connected";
    wsStatus.style.color = "var(--color-buy, #00e676)";
    bootWarning.style.display = "none";
  } else {
    wsStatus.innerText = "🔴 Reconnecting...";
    wsStatus.style.color = "var(--color-sell, #ff1744)";

    // Only show the massive "Server Booting" popup if we've NEVER connected before.
    // If we lose connection mid-way, just rely on the HUD icon.
    if (!hasConnectedOnce) {
      bootWarning.style.display = "flex";
    }
  }
};

const addWidgetBtn = document.getElementById("add-widget-btn")!;
const widgetCounter = document.getElementById("widget-counter")!;
const symbolDropdown = document.getElementById("symbol-dropdown")!;

const widgetHandlers = new Map<Widget, TradeSubscriber>();

// Render Dropdown
const allOption = document.createElement("div");
allOption.innerText = "ALL STOCKS";
allOption.classList.add("dropdown-item");
allOption.setAttribute("data-id", APP_CONFIG.WILDCARD_SYMBOL_ID.toString());
allOption.style.padding = "8px 12px";
allOption.style.cursor = "pointer";
allOption.style.color = "var(--text-primary, #fff)";
allOption.style.fontWeight = "bold";
allOption.addEventListener(
  "mouseenter",
  () =>
    (allOption.style.background =
      "var(--dropdown-hover, rgba(255, 255, 255, 0.1))")
);
allOption.addEventListener(
  "mouseleave",
  () => (allOption.style.background = "transparent")
);
symbolDropdown.appendChild(allOption);

let dropdownHtml = "";
for (let i = 0; i < 50; i++) {
  dropdownHtml += `<div class="dropdown-item" data-id="${i}">${getSymbolName(i)}</div>`;
}
symbolDropdown.insertAdjacentHTML("beforeend", dropdownHtml);

let activeTargetWidget: Widget | null = null;

function saveLayout() {
  const layout = engine
    .getWidgets()
    .map(w => [
      w.symbolId,
      Math.round(w.x),
      Math.round(w.y),
      Math.round(w.width),
      Math.round(w.height)
    ]);
  localStorage.setItem("widgets_layout", JSON.stringify(layout));
}

// Restore saved layout
const savedLayout = localStorage.getItem("widgets_layout");
if (savedLayout) {
  try {
    const layout = JSON.parse(savedLayout) as [
      number,
      number,
      number,
      number,
      number
    ][];
    for (const [symbolId, x, y, w, h] of layout) {
      const widget = new Widget(symbolId, x, y);
      widget.width = w;
      widget.height = h;
      const handler = (trades: Trade[]) => widget.addTrades(trades);
      widgetHandlers.set(widget, handler);
      engine.addWidget(widget);
      wsManager.subscribe(widget.symbolId, handler);
    }
    widgetCounter.innerText = `${engine.getWidgets().length} / ${APP_CONFIG.MAX_WIDGETS} Widgets`;
  } catch (e) {
    console.error("Failed to restore layout", e);
  }
}

engine.onLayoutChange = saveLayout;

// Handle Add Widget
addWidgetBtn.addEventListener("click", () => {
  const widgets = engine.getWidgets();
  if (widgets.length >= APP_CONFIG.MAX_WIDGETS) return;

  // Random default symbol from the top 10
  const defaultSymbolId = Math.floor(Math.random() * 10);

  // Stagger creation position
  const x = 50 + ((widgets.length * 30) % 300);
  const y = 50 + ((widgets.length * 30) % 300);

  const w = new Widget(defaultSymbolId, x, y);

  // Create a bound trade handler attached to the widget so we can unsubscribe correctly later
  const handler = (trades: Trade[]) => w.addTrades(trades);
  widgetHandlers.set(w, handler);

  engine.addWidget(w);
  wsManager.subscribe(w.symbolId, handler);

  widgetCounter.innerText = `${engine.getWidgets().length} / 50 Widgets`;
});

function clearAllWidgets() {
  const widgets = engine.getWidgets();
  for (const widget of [...widgets]) {
    const handler = widgetHandlers.get(widget);
    if (handler) {
      wsManager.unsubscribe(widget.symbolId, handler);
      widgetHandlers.delete(widget);
    }
    engine.removeWidget(widget);
  }
  widgetCounter.innerText = `0 / ${APP_CONFIG.MAX_WIDGETS} Widgets`;
  saveLayout();
}

const removeAllBtn = document.getElementById("remove-all-btn")!;
removeAllBtn.addEventListener("click", clearAllWidgets);

const fillWidgetsBtn = document.getElementById("fill-widgets-btn")!;
fillWidgetsBtn.addEventListener("click", () => {
  clearAllWidgets();

  for (let i = 0; i < APP_CONFIG.MAX_WIDGETS; i++) {
    const cols = Math.max(1, Math.floor(window.innerWidth / 360));
    const col = i % cols;
    const row = Math.floor(i / cols);

    // Stagger slightly if there are many rows so they look like a deck of cards
    const x = 20 + col * 350 + row * 15;
    const y = 80 + row * 40;

    const w = new Widget(i, x, y);

    const handler = (trades: Trade[]) => w.addTrades(trades);
    widgetHandlers.set(w, handler);
    engine.addWidget(w);
    wsManager.subscribe(w.symbolId, handler);
  }

  widgetCounter.innerText = `${APP_CONFIG.MAX_WIDGETS} / ${APP_CONFIG.MAX_WIDGETS} Widgets`;
  saveLayout();
});

// Hide dropdowns when clicking anywhere outside them
window.addEventListener("mousedown", e => {
  if (!(e.target as HTMLElement).closest(".dropdown")) {
    symbolDropdown.style.display = "none";
  }
});

// Engine Callbacks to show Dropdowns
engine.onSymbolClick = (widget, x, y) => {
  activeTargetWidget = widget;
  symbolDropdown.style.left = `${x}px`;
  symbolDropdown.style.top = `${y + 20}px`;
  symbolDropdown.style.display = "block";
};

engine.onCloseClick = widget => {
  const handler = widgetHandlers.get(widget);
  if (handler) {
    wsManager.unsubscribe(widget.symbolId, handler);
    widgetHandlers.delete(widget);
  }
  engine.removeWidget(widget);
  widgetCounter.innerText = `${engine.getWidgets().length} / 50 Widgets`;
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

        // Auto-expand if converting to ALL STOCKS and currently too small
        if (
          newId === APP_CONFIG.WILDCARD_SYMBOL_ID &&
          activeTargetWidget.width < WIDGET_LAYOUT.MIN_WIDTH_WILDCARD
        ) {
          activeTargetWidget.width = WIDGET_LAYOUT.MIN_WIDTH_WILDCARD;
        }

        wsManager.subscribe(newId, oldHandler);
        saveLayout();
      }
    }
    symbolDropdown.style.display = "none";
  }
});
