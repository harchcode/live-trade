import type { Trade } from './types';

export class Widget {
  public id: string;
  public x: number;
  public y: number;
  public width: number;
  public height: number;
  public symbolId: number;
  public filter: number; // 0 = ALL, 1 = BUY, 2 = SELL
  public trades: Trade[] = [];
  public scrollY: number = 0;

  // Design Aesthetics - Premium Dark Theme
  private bg = 'rgba(25, 25, 30, 0.85)';
  private border = 'rgba(255, 255, 255, 0.1)';
  private headerBg = 'rgba(30, 30, 35, 0.95)';
  private textPrimary = '#ffffff';
  private textSecondary = '#8b8b9e';
  private colorBuy = '#00e676'; // Vibrant green
  private colorSell = '#ff1744'; // Vibrant red

  constructor(symbolId: number, x: number, y: number) {
    this.id = Math.random().toString(36).substring(2, 9);
    this.symbolId = symbolId;
    this.x = x;
    this.y = y;
    this.width = 340;
    this.height = 420;
    this.filter = 0;
  }

  public addTrade(trade: Trade) {
    // Filtering logic
    if (this.filter === 1 && trade.side !== 0) return; // BUY filter
    if (this.filter === 2 && trade.side !== 1) return; // SELL filter

    this.trades.unshift(trade);
    if (this.trades.length > 100) {
      this.trades.length = 100;
    }
  }

  public isHit(mouseX: number, mouseY: number): boolean {
    return mouseX >= this.x && mouseX <= this.x + this.width &&
           mouseY >= this.y && mouseY <= this.y + this.height;
  }

  public isHitResize(mouseX: number, mouseY: number): boolean {
    const handleSize = 15;
    return mouseX >= this.x + this.width - handleSize && mouseX <= this.x + this.width &&
           mouseY >= this.y + this.height - handleSize && mouseY <= this.y + this.height;
  }

  public isHitHeaderSymbol(mouseX: number, mouseY: number): boolean {
    return mouseX >= this.x && mouseX <= this.x + this.width - 60 && 
           mouseY >= this.y && mouseY <= this.y + 44;
  }

  public isHitHeaderFilter(mouseX: number, mouseY: number): boolean {
    return mouseX >= this.x + this.width - 60 && mouseX <= this.x + this.width &&
           mouseY >= this.y && mouseY <= this.y + 44;
  }

  public draw(ctx: CanvasRenderingContext2D) {
    // Setup for glassmorphism-like clean rendering
    ctx.save();

    // Draw background
    ctx.fillStyle = this.bg;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.beginPath();
    ctx.roundRect(this.x, this.y, this.width, this.height, 8);
    ctx.fill();
    ctx.shadowColor = 'transparent'; // Reset shadow for other elements

    // Draw border
    ctx.strokeStyle = this.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw Header
    const headerHeight = 44;
    ctx.fillStyle = this.headerBg;
    ctx.beginPath();
    ctx.roundRect(this.x, this.y, this.width, headerHeight, [8, 8, 0, 0]);
    ctx.fill();

    // Header Separator
    ctx.beginPath();
    ctx.moveTo(this.x, this.y + headerHeight);
    ctx.lineTo(this.x + this.width, this.y + headerHeight);
    ctx.stroke();

    // Header Text (Symbol Name placeholder for now)
    ctx.fillStyle = this.textPrimary;
    ctx.font = '600 15px Inter, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(`SYMBOL ID: ${this.symbolId}`, this.x + 16, this.y + headerHeight / 2);

    // Filter text indicator
    ctx.fillStyle = this.textSecondary;
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'right';
    const filterText = this.filter === 0 ? 'ALL' : this.filter === 1 ? 'BUY' : 'SELL';
    ctx.fillText(filterText, this.x + this.width - 16, this.y + headerHeight / 2);
    ctx.textAlign = 'left';

    // Draw Trades (Clipped)
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.x, this.y + headerHeight, this.width, this.height - headerHeight - 4);
    ctx.clip();

    let drawY = this.y + headerHeight + 20 - this.scrollY;
    ctx.font = '13px "JetBrains Mono", monospace, sans-serif';
    ctx.textBaseline = 'middle';

    for (const trade of this.trades) {
      // Row culling
      if (drawY < this.y + headerHeight - 15) {
        drawY += 24;
        continue;
      }
      if (drawY > this.y + this.height + 15) {
        break; // Out of bounds below
      }

      // Time
      const timeStr = new Date(Number(trade.timestamp)).toLocaleTimeString([], {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      ctx.fillStyle = this.textSecondary;
      ctx.fillText(timeStr, this.x + 16, drawY);

      // Side
      ctx.fillStyle = trade.side === 1 ? this.colorSell : this.colorBuy;
      const sideText = trade.side === 1 ? 'SELL' : 'BUY ';
      ctx.fillText(sideText, this.x + 100, drawY);

      // Price
      ctx.fillStyle = this.textPrimary;
      ctx.textAlign = 'right';
      const priceStr = trade.price.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      ctx.fillText(priceStr, this.x + 220, drawY);

      // Amount
      ctx.fillStyle = this.textSecondary;
      const amountStr = trade.amount.toLocaleString(undefined, {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      });
      ctx.fillText(amountStr, this.x + this.width - 16, drawY);

      ctx.textAlign = 'left';
      drawY += 24;
    }

    ctx.restore(); // Restore clip
    ctx.restore(); // Restore main
  }
}
