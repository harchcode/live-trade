import { Widget } from './Widget';

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

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    
    // Bind event listeners for interaction
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);

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
  }

  public addWidget(widget: Widget) {
    this.widgets.push(widget);
  }

  public getWidgets() {
    return this.widgets;
  }

  // --- INTERACTION LOGIC ---

  private onMouseDown = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Search from top-most (end of array) to bottom-most
    for (let i = this.widgets.length - 1; i >= 0; i--) {
      const widget = this.widgets[i];
      
      // Check resize handle first (bottom-right corner)
      if (widget.isHitResize(x, y)) {
        this.bringToFront(i);
        this.activeWidget = widget;
        this.isResizing = true;
        this.canvas.style.cursor = 'nwse-resize';
        return;
      }
      
      // Check general hit (drag)
      if (widget.isHit(x, y)) {
        this.bringToFront(i);
        this.activeWidget = widget;
        this.isDragging = true;
        this.dragOffsetX = x - widget.x;
        this.dragOffsetY = y - widget.y;
        this.canvas.style.cursor = 'grabbing';
        return;
      }
    }
  }

  private onMouseMove = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.activeWidget) {
      if (this.isResizing) {
        // Enforce a minimum size so it doesn't collapse
        const newWidth = Math.max(250, x - this.activeWidget.x);
        const newHeight = Math.max(200, y - this.activeWidget.y);
        this.activeWidget.width = newWidth;
        this.activeWidget.height = newHeight;
      } else if (this.isDragging) {
        this.activeWidget.x = x - this.dragOffsetX;
        this.activeWidget.y = y - this.dragOffsetY;
      }
      return; // Skip hover logic while actively dragging/resizing
    }

    // Hover detection for dynamic cursor styling
    let cursor = 'default';
    for (let i = this.widgets.length - 1; i >= 0; i--) {
      const widget = this.widgets[i];
      if (widget.isHitResize(x, y)) {
        cursor = 'nwse-resize';
        break;
      }
      if (widget.isHit(x, y)) {
        cursor = 'grab';
        break;
      }
    }
    this.canvas.style.cursor = cursor;
  }

  private onMouseUp = () => {
    if (this.activeWidget) {
      this.isDragging = false;
      this.isResizing = false;
      this.activeWidget = null;
      // Cursor style will reset on next mousemove
    }
  }

  private bringToFront(index: number) {
    const widget = this.widgets.splice(index, 1)[0];
    this.widgets.push(widget); // Push to end so it renders last (on top)
  }

  // --- RENDER LOOP ---

  private loop = () => {
    const rect = this.canvas.getBoundingClientRect();
    
    // Clear screen
    this.ctx.clearRect(0, 0, rect.width, rect.height);
    
    // Draw premium dark background
    this.ctx.fillStyle = '#0a0a0c'; 
    this.ctx.fillRect(0, 0, rect.width, rect.height);

    // Subtle grid dots
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    for(let x = 0; x < rect.width; x += 30) {
      for(let y = 0; y < rect.height; y += 30) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, 1, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    // Draw widgets
    for (const widget of this.widgets) {
      // Culling: only draw if intersecting the screen bounds
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
