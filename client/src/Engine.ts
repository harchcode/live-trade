import { Widget } from "./Widget";
import type { WSManager } from "./WSManager";
import { getTheme } from "./theme";

export class Engine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private widgets: Widget[] = [];
  private dpr: number = 1;

  // Interactivity State
  private activeWidget: Widget | null = null;
  private isResizing = false;
  private isDragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private dragStartX = 0;
  private dragStartY = 0;

  // Performance Monitoring
  private lastTime = performance.now();
  private frameCount = 0;
  private fps = 0;
  private fpsEl: HTMLElement | null = null;
  private memEl: HTMLElement | null = null;
  private dataEl: HTMLElement | null = null;
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
    this.memEl = document.getElementById("mem-counter");
    this.dataEl = document.getElementById("data-counter");

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

    this.scrollOverlay.addEventListener("mousedown", e => {
      if (e.offsetX >= this.scrollOverlay.clientWidth) return;
      const canvasEvent = new MouseEvent("mousedown", {
        clientX: e.clientX,
        clientY: e.clientY,
        bubbles: true
      });
      this.canvas.dispatchEvent(canvasEvent);
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
    this.syncScrollOverlay(); // Update positions on resize
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

    const headerHeight = 44;
    this.scrollOverlay.style.left = `${this.activeWidget.x}px`;
    this.scrollOverlay.style.top = `${this.activeWidget.y + headerHeight}px`;
    this.scrollOverlay.style.width = `${this.activeWidget.width}px`;
    this.scrollOverlay.style.height = `${this.activeWidget.height - headerHeight - 15}px`; // Leave bottom 15px for resize handle
    this.scrollOverlay.style.display = "block";

    const tradesHeight = this.activeWidget.trades.length * 24 + 20;
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

      if (widget.isHitResize(x, y)) {
        this.bringToFront(i);
        this.activeWidget = widget;
        this.isResizing = true;
        this.canvas.style.cursor = "nwse-resize";
        this.scrollOverlay.style.display = "none"; // Hide to prevent jitter
        return;
      }

      if (widget.isHit(x, y)) {
        this.bringToFront(i);
        this.activeWidget = widget;
        this.isDragging = true;
        this.dragOffsetX = x - widget.x;
        this.dragOffsetY = y - widget.y;
        this.dragStartX = x;
        this.dragStartY = y;
        this.canvas.style.cursor = "grabbing";
        this.scrollOverlay.style.display = "none"; // Hide to prevent jitter
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
      if (this.isResizing) {
        const newWidth = Math.max(250, x - this.activeWidget.x);
        const newHeight = Math.max(200, y - this.activeWidget.y);
        this.activeWidget.width = newWidth;
        this.activeWidget.height = newHeight;
      } else if (this.isDragging) {
        this.activeWidget.x = x - this.dragOffsetX;
        this.activeWidget.y = y - this.dragOffsetY;
      }
      return;
    }

    let cursor = "default";
    for (let i = this.widgets.length - 1; i >= 0; i--) {
      const widget = this.widgets[i];
      if (widget.isHitResize(x, y)) {
        cursor = "nwse-resize";
        break;
      }
      if (widget.isHitHeaderClose(x, y) || widget.isHitHeaderSymbol(x, y)) {
        cursor = "pointer";
        break;
      }
      if (widget.isHit(x, y)) {
        cursor = "grab";
        break;
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
      this.isResizing = false;
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
    if (now - this.lastTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastTime = now;

      if (this.fpsEl) {
        this.fpsEl.innerText = `FPS: ${this.fps}`;
        this.fpsEl.style.color =
          this.fps >= 50 ? "#00e676" : this.fps >= 30 ? "#ffb300" : "#ff1744";
      }

      const perf = performance as Performance & {
        memory?: { usedJSHeapSize: number };
      };
      if (this.memEl && perf.memory) {
        const mb = (perf.memory.usedJSHeapSize / 1048576).toFixed(1);
        this.memEl.innerText = `Mem: ${mb} MB`;
      }

      if (this.dataEl && this.wsManager) {
        const bytes = this.wsManager.totalBytesReceived;
        if (bytes > 1048576) {
          const mb = (bytes / 1048576).toFixed(2);
          this.dataEl.innerText = `Data: ${mb} MB`;
        } else {
          const kb = (bytes / 1024).toFixed(1);
          this.dataEl.innerText = `Data: ${kb} KB`;
        }
      }
    }

    const rect = this.canvas.getBoundingClientRect();
    const t = getTheme();

    this.ctx.clearRect(0, 0, rect.width, rect.height);
    this.ctx.fillStyle = t.bg;
    this.ctx.fillRect(0, 0, rect.width, rect.height);

    this.ctx.fillStyle = t.grid;
    for (let x = 0; x < rect.width; x += 30) {
      for (let y = 0; y < rect.height; y += 30) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, 1, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    for (const widget of this.widgets) {
      if (widget === this.activeWidget) {
        const tradesHeight = widget.trades.length * 24 + 20;
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
