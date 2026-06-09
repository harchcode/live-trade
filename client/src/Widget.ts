import { type Trade, getSymbolName } from "./types";
import { getTheme } from "./theme";

export class Widget {
  public id: string;
  public x: number;
  public y: number;
  public width: number;
  public height: number;
  public symbolId: number;
  public trades: Trade[] = [];
  public scrollY: number = 0;

  constructor(symbolId: number, x: number, y: number) {
    this.id = Math.random().toString(36).substring(2, 9);
    this.symbolId = symbolId;
    this.x = x;
    this.y = y;
    this.width = 340;
    this.height = 420;
  }

  public addTrades(newTrades: Trade[]) {
    this.trades.unshift(...newTrades);
    if (this.trades.length > 100) {
      this.trades.length = 100;
    }
  }

  public isHit(mouseX: number, mouseY: number): boolean {
    return (
      mouseX >= this.x &&
      mouseX <= this.x + this.width &&
      mouseY >= this.y &&
      mouseY <= this.y + this.height
    );
  }

  public isHitResize(mouseX: number, mouseY: number): boolean {
    const handleSize = 15;
    return (
      mouseX >= this.x + this.width - handleSize &&
      mouseX <= this.x + this.width &&
      mouseY >= this.y + this.height - handleSize &&
      mouseY <= this.y + this.height
    );
  }

  public isHitHeaderSymbol(mouseX: number, mouseY: number, ctx?: CanvasRenderingContext2D): boolean {
    const titleWidth = ctx ? ctx.measureText(getSymbolName(this.symbolId)).width + 20 : 100;
    return mouseX >= this.x + 10 && mouseX <= this.x + 10 + titleWidth && mouseY >= this.y + 10 && mouseY <= this.y + 34;
  }

  public isHitHeader(mouseX: number, mouseY: number): boolean {
    return mouseX >= this.x && mouseX <= this.x + this.width && mouseY >= this.y && mouseY <= this.y + 44;
  }

  public isHitHeaderClose(mouseX: number, mouseY: number): boolean {
    return (
      mouseX >= this.x + this.width - 44 &&
      mouseX <= this.x + this.width &&
      mouseY >= this.y &&
      mouseY <= this.y + 44
    );
  }

  public draw(ctx: CanvasRenderingContext2D, isActive: boolean = false) {
    const t = getTheme();
    const headerHeight = 44;
    
    // Setup for glassmorphism-like clean rendering
    ctx.save();

    // Hard Drop Shadow (High Performance, No Blur)
    const shadowOffset = isActive ? 8 : 4;
    ctx.fillStyle = t.shadow;
    ctx.beginPath();
    ctx.roundRect(this.x + shadowOffset, this.y + shadowOffset, this.width, this.height, 8);
    ctx.fill();

    // Draw background (Body)
    ctx.fillStyle = t.widgetBg;
    ctx.beginPath();
    ctx.roundRect(this.x, this.y, this.width, this.height, 8);
    ctx.fill();

    // Draw Header Fill
    ctx.fillStyle = t.widgetHeaderBg;
    ctx.beginPath();
    ctx.roundRect(this.x, this.y, this.width, 44, [8, 8, 0, 0]);
    ctx.fill();

    // Draw Unified Outline Border
    ctx.beginPath();
    ctx.roundRect(this.x, this.y, this.width, this.height, 8);
    ctx.strokeStyle = isActive ? t.widgetBorderActive : t.widgetBorder;
    ctx.lineWidth = isActive ? 2 : 1;
    ctx.stroke();

    // Header Text
    ctx.fillStyle = t.textPrimary;
    ctx.font = "600 15px Inter, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(
      getSymbolName(this.symbolId),
      this.x + 16,
      this.y + headerHeight / 2
    );

    // Close button indicator
    ctx.fillStyle = t.textSecondary;
    ctx.font = "14px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("✕", this.x + this.width - 22, this.y + headerHeight / 2);
    ctx.textAlign = "left";

    // Draw Trades (Clipped)
    ctx.save();
    ctx.beginPath();
    ctx.rect(
      this.x,
      this.y + headerHeight,
      this.width,
      this.height - headerHeight - 4
    );
    ctx.clip();

    let drawY = this.y + headerHeight + 20 - this.scrollY;
    ctx.font = '13px "JetBrains Mono", monospace, sans-serif';
    ctx.textBaseline = "middle";

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
      ctx.fillStyle = t.textSecondary;
      ctx.fillText(trade.timeStr || "", this.x + 16, drawY);

      // Side
      ctx.fillStyle = trade.side === 1 ? t.colorSell : t.colorBuy;
      const sideText = trade.side === 1 ? "SELL" : "BUY ";
      ctx.fillText(sideText, this.x + 90, drawY);

      // Price
      ctx.fillStyle = t.textPrimary;
      ctx.textAlign = "right";
      ctx.fillText(trade.priceStr || "", this.x + 245, drawY);

      // Amount
      ctx.fillStyle = t.textSecondary;
      ctx.fillText(trade.amountStr || "", this.x + this.width - 16, drawY);

      ctx.textAlign = "left";
      drawY += 24;
    }

    ctx.restore(); // Restore clip
    ctx.restore(); // Restore main
  }
}
