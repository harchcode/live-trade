import { Widget } from './Widget';

export class Engine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private widgets: Widget[] = [];
  private dpr: number = 1;

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.loop();
  }

  private resize() {
    this.dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.parentElement!.getBoundingClientRect();

    // CSS size
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;

    // High DPI Canvas size
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

  private loop = () => {
    const rect = this.canvas.getBoundingClientRect();

    // Clear screen
    this.ctx.clearRect(0, 0, rect.width, rect.height);

    // Draw premium dark background
    this.ctx.fillStyle = '#0a0a0c';
    this.ctx.fillRect(0, 0, rect.width, rect.height);

    // Optional: Draw subtle grid dots for terminal aesthetic
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    for (let x = 0; x < rect.width; x += 30) {
      for (let y = 0; y < rect.height; y += 30) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, 1, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    // Draw widgets (reverse order or sorted by z-index eventually)
    for (const widget of this.widgets) {
      // Basic culling: only draw if within canvas
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
