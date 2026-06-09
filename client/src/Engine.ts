import { Widget } from "./Widget";

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
  private zIndexCounter = 10;

  // Performance Monitoring
  private lastTime = performance.now();
  private frameCount = 0;
  private fps = 0;
  private fpsEl: HTMLElement | null = null;
  private memEl: HTMLElement | null = null;

  // DOM Overlays
  private uiLayer: HTMLDivElement;
  private scrollOverlays = new Map<Widget, HTMLDivElement>();

  // Callbacks
  public onSymbolClick?: (widget: Widget, x: number, y: number) => void;
  public onFilterClick?: (widget: Widget, x: number, y: number) => void;

  constructor(canvasId: string, uiLayerId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.uiLayer = document.getElementById(uiLayerId) as HTMLDivElement;
    this.ctx = this.canvas.getContext("2d")!;

    this.fpsEl = document.getElementById("fps-counter");
    this.memEl = document.getElementById("mem-counter");

    this.resize();
    window.addEventListener("resize", () => this.resize());

    this.canvas.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mouseup", this.onMouseUp);

    this.loop();
  }

  private resize() {
    this.dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.parentElement!.getBoundingClientRect();

    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;

    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = rect.height * this.dpr;

    this.ctx.scale(this.dpr, this.dpr);
    this.showAllScrollOverlays(); // Update positions on resize
  }

  public addWidget(widget: Widget) {
    this.widgets.push(widget);
    this.createScrollOverlay(widget);
  }

  public removeWidget(widget: Widget) {
    const idx = this.widgets.indexOf(widget);
    if (idx > -1) {
      this.widgets.splice(idx, 1);
      const div = this.scrollOverlays.get(widget);
      if (div) {
        div.remove();
        this.scrollOverlays.delete(widget);
      }
    }
  }

  public getWidgets() {
    return this.widgets;
  }

  // --- DOM SCROLL OVERLAYS ---

  private createScrollOverlay(widget: Widget) {
    const div = document.createElement("div");
    div.style.position = "absolute";
    div.style.overflowY = "auto";
    div.style.overflowX = "hidden";
    div.style.pointerEvents = "auto"; // allow scrolling interaction
    div.style.zIndex = (this.zIndexCounter++).toString(); // Start with proper z-index

    // Webkit specific styling to hide scrollbars until hover (or style natively)
    div.className = "widget-scroll-overlay";

    // A tall transparent div to force scrolling logic
    // 100 max trades * 24px row height + some padding
    const content = document.createElement("div");
    content.style.width = "100%";
    content.style.height = "2450px";
    div.appendChild(content);

    div.addEventListener("scroll", () => {
      widget.scrollY = div.scrollTop;
    });

    div.addEventListener("mousedown", e => {
      // If clicking on the native scrollbar, let the browser handle it
      if (e.offsetX >= div.clientWidth) {
        return;
      }

      // Otherwise, forward the click to the Canvas to handle proper z-index and drag logic
      const canvasEvent = new MouseEvent("mousedown", {
        clientX: e.clientX,
        clientY: e.clientY,
        bubbles: true
      });
      this.canvas.dispatchEvent(canvasEvent);
    });

    this.uiLayer.appendChild(div);
    this.scrollOverlays.set(widget, div);
    this.positionScrollOverlay(widget, div);
  }

  private positionScrollOverlay(widget: Widget, div: HTMLDivElement) {
    const headerHeight = 44;
    div.style.left = `${widget.x}px`;
    div.style.top = `${widget.y + headerHeight}px`;
    div.style.width = `${widget.width}px`;
    div.style.height = `${widget.height - headerHeight - 15}px`; // Leave bottom 15px for resize handle
    div.style.display = "block";
  }

  private hideAllScrollOverlays() {
    this.scrollOverlays.forEach(div => (div.style.display = "none"));
  }

  private showAllScrollOverlays() {
    this.widgets.forEach(w => {
      const div = this.scrollOverlays.get(w);
      if (div) this.positionScrollOverlay(w, div);
    });
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
        this.hideAllScrollOverlays(); // Hide to prevent jitter
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
        this.hideAllScrollOverlays(); // Hide to prevent jitter
        return;
      }
    }
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
      if (widget.isHitHeaderFilter(x, y) || widget.isHitHeaderSymbol(x, y)) {
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
          if (this.activeWidget.isHitHeaderFilter(x, y)) {
            this.onFilterClick?.(this.activeWidget, e.clientX, e.clientY);
          } else if (this.activeWidget.isHitHeaderSymbol(x, y)) {
            this.onSymbolClick?.(this.activeWidget, e.clientX, e.clientY);
          }
        }
      }

      this.isDragging = false;
      this.isResizing = false;
      this.activeWidget = null;
      this.showAllScrollOverlays(); // Put DOM overlays back over canvas exactly matching new bounds
    }
  };

  private bringToFront(index: number) {
    const widget = this.widgets.splice(index, 1)[0];
    this.widgets.push(widget);

    // Crucial: Update DOM overlay z-index so it doesn't block clicks to newer widgets
    const div = this.scrollOverlays.get(widget);
    if (div) {
      div.style.zIndex = (this.zIndexCounter++).toString();
    }
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

      if (this.memEl && (performance as any).memory) {
        const memory = (performance as any).memory;
        const mb = (memory.usedJSHeapSize / 1048576).toFixed(1);
        this.memEl.innerText = `Mem: ${mb} MB`;
      }
    }

    const rect = this.canvas.getBoundingClientRect();

    this.ctx.clearRect(0, 0, rect.width, rect.height);
    this.ctx.fillStyle = "#0a0a0c";
    this.ctx.fillRect(0, 0, rect.width, rect.height);

    this.ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
    for (let x = 0; x < rect.width; x += 30) {
      for (let y = 0; y < rect.height; y += 30) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, 1, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    for (const widget of this.widgets) {
      if (
        widget.x + widget.width > 0 &&
        widget.x < rect.width &&
        widget.y + widget.height > 0 &&
        widget.y < rect.height
      ) {
        widget.draw(this.ctx);
      }
    }

    requestAnimationFrame(this.loop);
  };
}
