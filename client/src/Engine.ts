import { Widget } from "./Widget";
import type { WSManager } from "./WSManager";
import { APP_CONFIG, WIDGET_LAYOUT } from "./constants";
import { getTheme } from "./theme";

export class Engine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private widgets: Widget[] = [];
  private dpr: number = 1;
  private gridCache: HTMLCanvasElement | null = null;
  private lastThemeName: string = "";

  // Interactivity State
  private activeWidget: Widget | null = null;
  private resizeEdge: string | null = null;
  private dragStartBounds = { x: 0, y: 0, w: 0, h: 0 };
  private isDragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private dragStartX = 0;
  private dragStartY = 0;

  // Performance Monitoring
  private lastFpsTime = performance.now();
  private lastTradeCount = 0;
  private lastBytesCount = 0;
  private frameCount = 0;
  private fps = 0;
  private fpsEl: HTMLElement | null = null;
  private wsManager: WSManager | null = null;

  // DOM Overlays
  private uiLayer: HTMLDivElement;
  private scrollOverlay: HTMLDivElement;
  private scrollContent: HTMLDivElement;
  private isProgrammaticScroll = false;

  // Callbacks
  public onSymbolClick?: (widget: Widget, x: number, y: number) => void;
  public onCloseClick?: (widget: Widget) => void;
  public onLayoutChange?: () => void;

  constructor(canvasId: string, uiLayerId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.uiLayer = document.getElementById(uiLayerId) as HTMLDivElement;
    this.ctx = this.canvas.getContext("2d")!;

    this.fpsEl = document.getElementById("fps-counter");

    // Initialize Singleton Scroll Overlay FIRST before resize triggers syncScrollOverlay
    this.scrollOverlay = document.createElement("div");
    this.scrollOverlay.style.position = "absolute";
    this.scrollOverlay.style.overflowY = "auto";
    this.scrollOverlay.style.overflowX = "hidden";
    this.scrollOverlay.style.pointerEvents = "auto";
    this.scrollOverlay.style.display = "none";
    this.scrollOverlay.className = "widget-scroll-overlay";

    this.scrollContent = document.createElement("div");
    this.scrollContent.style.width = "100%";
    this.scrollOverlay.appendChild(this.scrollContent);

    this.scrollOverlay.addEventListener("scroll", () => {
      if (this.isProgrammaticScroll) return;
      if (this.activeWidget) {
        this.activeWidget.scrollY = this.scrollOverlay.scrollTop;
      }
    });

    this.uiLayer.appendChild(this.scrollOverlay);

    this.resize();
    window.addEventListener("resize", () => this.resize());

    this.canvas.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mouseup", this.onMouseUp);

    this.loop();
  }

  public setWSManager(manager: WSManager) {
    this.wsManager = manager;
  }

  private resize() {
    this.dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.parentElement!.getBoundingClientRect();

    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;

    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = rect.height * this.dpr;

    this.ctx.scale(this.dpr, this.dpr);
    this.updateGridCache(rect.width, rect.height);
    this.syncScrollOverlay(); // Update positions on resize
  }

  private updateGridCache(width: number, height: number) {
    if (!this.gridCache) {
      this.gridCache = document.createElement("canvas");
    }

    // Scale cache canvas to match DPR for crisp rendering
    this.gridCache.width = width * this.dpr;
    this.gridCache.height = height * this.dpr;
    const ctx = this.gridCache.getContext("2d")!;
    ctx.scale(this.dpr, this.dpr);

    const t = getTheme();
    ctx.fillStyle = t.bg;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = t.grid;
    for (let x = 0; x < width; x += 30) {
      for (let y = 0; y < height; y += 30) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  public addWidget(widget: Widget) {
    this.widgets.push(widget);
    this.activeWidget = widget;
    this.syncScrollOverlay();
    this.onLayoutChange?.();
  }

  public removeWidget(widget: Widget) {
    const idx = this.widgets.indexOf(widget);
    if (idx > -1) {
      this.widgets.splice(idx, 1);
      if (this.activeWidget === widget) {
        this.activeWidget = null;
        this.syncScrollOverlay();
      }
      this.onLayoutChange?.();
    }
  }

  public getWidgets() {
    return this.widgets;
  }

  // --- DOM SCROLL OVERLAYS ---

  private syncScrollOverlay() {
    if (!this.activeWidget) {
      this.scrollOverlay.style.display = "none";
      return;
    }

    const headerHeight = WIDGET_LAYOUT.HEADER_HEIGHT;
    const inset = WIDGET_LAYOUT.INSET;
    this.scrollOverlay.style.left = `${this.activeWidget.x + inset}px`;
    this.scrollOverlay.style.top = `${this.activeWidget.y + headerHeight}px`;
    this.scrollOverlay.style.width = `${this.activeWidget.width - inset * 2}px`;
    this.scrollOverlay.style.height = `${this.activeWidget.height - headerHeight - inset}px`; // Leave bottom space for handle
    this.scrollOverlay.style.display = "block";

    const tradesHeight =
      WIDGET_LAYOUT.MAX_SCROLL_ROWS * WIDGET_LAYOUT.ROW_HEIGHT +
      WIDGET_LAYOUT.HEADER_HEIGHT;
    const newHeightStr = `${Math.max(this.scrollOverlay.clientHeight, tradesHeight)}px`;
    if (this.scrollContent.style.height !== newHeightStr) {
      this.scrollContent.style.height = newHeightStr;
    }

    this.isProgrammaticScroll = true;
    this.scrollOverlay.scrollTop = this.activeWidget.scrollY;
    this.isProgrammaticScroll = false;
  }

  // --- INTERACTION LOGIC ---

  private onMouseDown = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    for (let i = this.widgets.length - 1; i >= 0; i--) {
      const widget = this.widgets[i];
      const edge = widget.getHitEdge(x, y);

      if (widget.isHit(x, y) || edge) {
        if (this.activeWidget !== widget) {
          // Focus inactive widget and immediately return
          this.bringToFront(i);
          this.activeWidget = widget;
          this.syncScrollOverlay();
          return;
        }

        // Active widget interactions
        if (edge) {
          this.resizeEdge = edge;

          const edgeCursorMap: Record<string, string> = {
            n: "ns-resize",
            s: "ns-resize",
            e: "ew-resize",
            w: "ew-resize",
            nw: "nwse-resize",
            se: "nwse-resize",
            ne: "nesw-resize",
            sw: "nesw-resize"
          };
          this.canvas.style.cursor = edgeCursorMap[edge];

          this.dragStartX = x;
          this.dragStartY = y;
          this.dragStartBounds = {
            x: widget.x,
            y: widget.y,
            w: widget.width,
            h: widget.height
          };

          this.scrollOverlay.style.display = "none";
          return;
        }

        if (widget.isHitHeader(x, y)) {
          this.isDragging = true;
          this.dragOffsetX = x - widget.x;
          this.dragOffsetY = y - widget.y;
          this.dragStartX = x;
          this.dragStartY = y;
          this.canvas.style.cursor = "grabbing";
          this.scrollOverlay.style.display = "none";
          return;
        }

        // Hit the active widget body (e.g. bottom gap), do nothing
        return;
      }
    }

    // Clicked background, clear active widget
    this.activeWidget = null;
    this.syncScrollOverlay();
  };

  private onMouseMove = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.activeWidget) {
      if (this.resizeEdge) {
        const dx = x - this.dragStartX;
        const dy = y - this.dragStartY;
        const b = this.dragStartBounds;

        let newX = b.x;
        let newY = b.y;
        let newW = b.w;
        let newH = b.h;

        const minW =
          this.activeWidget.symbolId === APP_CONFIG.WILDCARD_SYMBOL_ID
            ? WIDGET_LAYOUT.MIN_WIDTH_WILDCARD
            : WIDGET_LAYOUT.MIN_WIDTH_NORMAL;

        if (this.resizeEdge.includes("e")) newW = Math.max(minW, b.w + dx);
        if (this.resizeEdge.includes("s"))
          newH = Math.max(WIDGET_LAYOUT.MIN_HEIGHT, b.h + dy);

        if (this.resizeEdge.includes("w")) {
          newW = Math.max(minW, b.w - dx);
          newX = b.x + (b.w - newW); // Shift X to keep right edge pinned
        }
        if (this.resizeEdge.includes("n")) {
          newH = Math.max(WIDGET_LAYOUT.MIN_HEIGHT, b.h - dy);
          newY = b.y + (b.h - newH); // Shift Y to keep bottom edge pinned
        }

        this.activeWidget.x = newX;
        this.activeWidget.y = newY;
        this.activeWidget.width = newW;
        this.activeWidget.height = newH;
      } else if (this.isDragging) {
        this.activeWidget.x = x - this.dragOffsetX;
        this.activeWidget.y = y - this.dragOffsetY;
      }
      if (this.resizeEdge || this.isDragging) return;
    }

    let cursor = "default";
    for (let i = this.widgets.length - 1; i >= 0; i--) {
      const widget = this.widgets[i];
      const edge = widget.getHitEdge(x, y);

      if (widget.isHit(x, y) || edge) {
        if (widget === this.activeWidget) {
          if (edge) {
            const edgeCursorMap: Record<string, string> = {
              n: "ns-resize",
              s: "ns-resize",
              e: "ew-resize",
              w: "ew-resize",
              nw: "nwse-resize",
              se: "nwse-resize",
              ne: "nesw-resize",
              sw: "nesw-resize"
            };
            cursor = edgeCursorMap[edge];
          } else if (
            widget.isHitHeaderClose(x, y) ||
            widget.isHitHeaderSymbol(x, y)
          ) {
            cursor = "pointer";
          } else if (widget.isHitHeader(x, y)) {
            cursor = "grab";
          } else {
            cursor = "default";
          }
        }
        // If it's an inactive widget, keep cursor="default" (don't show pointer/grab)
        break; // Top-most widget found, stop checking below
      }
    }
    this.canvas.style.cursor = cursor;
  };

  private onMouseUp = (e: MouseEvent) => {
    if (this.activeWidget) {
      if (this.isDragging) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const dx = x - this.dragStartX;
        const dy = y - this.dragStartY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Treat short drags as clicks
        if (distance < 5) {
          if (this.activeWidget.isHitHeaderClose(x, y)) {
            this.onCloseClick?.(this.activeWidget);
          } else if (this.activeWidget.isHitHeaderSymbol(x, y)) {
            this.onSymbolClick?.(this.activeWidget, e.clientX, e.clientY);
          }
        }
      }

      this.isDragging = false;
      this.resizeEdge = null;
      this.syncScrollOverlay(); // Put DOM overlays back over canvas exactly matching new bounds
      this.onLayoutChange?.();
    }
  };

  private bringToFront(index: number) {
    const widget = this.widgets.splice(index, 1)[0];
    this.widgets.push(widget);
  }

  // --- RENDER LOOP ---

  private loop = () => {
    const now = performance.now();
    this.frameCount++;

    if (now - this.lastFpsTime >= APP_CONFIG.FPS_THROTTLE_MS) {
      this.fps = Math.round(
        (this.frameCount * 1000) / (now - this.lastFpsTime)
      );
      this.frameCount = 0;
      this.lastFpsTime = now;

      if (this.fpsEl) {
        this.fpsEl.innerText = `FPS: ${this.fps}`;
        this.fpsEl.style.color =
          this.fps >= 50 ? "#00e676" : this.fps >= 30 ? "#ffb300" : "#ff1744";
      }

      if (this.wsManager) {
        // Memory
        const memCounter = document.getElementById("mem-counter");
        const perf = performance as Performance & {
          memory?: { usedJSHeapSize: number };
        };
        if (memCounter && perf.memory) {
          const used = Math.round(perf.memory.usedJSHeapSize / 1024 / 1024);
          memCounter.innerText = `Mem: ${used} MB`;
        }

        // Data/s (Bandwidth)
        const bytesPerSec =
          this.wsManager.totalBytesReceived - this.lastBytesCount;
        this.lastBytesCount = this.wsManager.totalBytesReceived;
        const kbps = (bytesPerSec / 1024).toFixed(1);

        const dataCounter = document.getElementById("data-counter");
        if (dataCounter) {
          const isHigh =
            bytesPerSec > APP_CONFIG.HIGH_BANDWIDTH_WARNING_KBPS * 1024;
          dataCounter.innerText = `Data: ${kbps} KB/s${isHigh ? " ⚠️" : ""}`;
          dataCounter.style.color = isHigh
            ? "var(--color-sell, #ff1744)"
            : "var(--text-secondary, #8b8b9e)";
        }

        // Trades/s
        const tradesPerSec =
          this.wsManager.totalTradesReceived - this.lastTradeCount;
        this.lastTradeCount = this.wsManager.totalTradesReceived;

        const tradeCounter = document.getElementById("trade-counter");
        if (tradeCounter) tradeCounter.innerText = `Trades/s: ${tradesPerSec}`;

        const dataWarning = document.getElementById("data-warning");
        if (dataWarning) {
          const hasWildcard = this.widgets.some(
            w => w.symbolId === APP_CONFIG.WILDCARD_SYMBOL_ID
          );
          if (hasWildcard || this.widgets.length >= 20 || tradesPerSec > 1000) {
            dataWarning.style.display = "block";
          } else {
            dataWarning.style.display = "none";
          }
        }
      }
    }

    const rect = this.canvas.getBoundingClientRect();

    // Check for theme changes to regenerate cache
    const currentThemeName = localStorage.getItem("theme") || "dark";
    if (this.lastThemeName !== currentThemeName) {
      this.lastThemeName = currentThemeName;
      this.updateGridCache(rect.width, rect.height);
    }

    if (this.gridCache) {
      this.ctx.drawImage(this.gridCache, 0, 0, rect.width, rect.height);
    } else {
      const t = getTheme();
      this.ctx.fillStyle = t.bg;
      this.ctx.fillRect(0, 0, rect.width, rect.height);
    }

    for (const widget of this.widgets) {
      if (widget === this.activeWidget) {
        const tradesHeight = 100 * 24 + 20; // Assume max 100 rows for consistent scrollbar thumb size
        const newHeightStr = `${Math.max(this.scrollOverlay.clientHeight, tradesHeight)}px`;
        if (this.scrollContent.style.height !== newHeightStr) {
          this.scrollContent.style.height = newHeightStr;
        }
      }

      if (
        widget.x + widget.width > 0 &&
        widget.x < rect.width &&
        widget.y + widget.height > 0 &&
        widget.y < rect.height
      ) {
        widget.draw(this.ctx, widget === this.activeWidget);
      }
    }

    requestAnimationFrame(this.loop);
  };
}
