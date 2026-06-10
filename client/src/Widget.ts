import { type Trade, getSymbolName } from "./types";
import { APP_CONFIG, WIDGET_LAYOUT, COLUMN_POSITIONS, SPARKLINE } from "./constants";
import { getTheme } from "./theme";

export class Widget {
  public id: string;
  public maxRows = WIDGET_LAYOUT.MAX_ROWS;
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

  public getHitEdge(mouseX: number, mouseY: number): string | null {
    const handle = 8;
    const isLeft = Math.abs(mouseX - this.x) <= handle;
    const isRight = Math.abs(mouseX - (this.x + this.width)) <= handle;
    const isTop = Math.abs(mouseY - this.y) <= handle;
    const isBottom = Math.abs(mouseY - (this.y + this.height)) <= handle;

    if (mouseX < this.x - handle || mouseX > this.x + this.width + handle ||
        mouseY < this.y - handle || mouseY > this.y + this.height + handle) {
      return null;
    }

    if (isTop && isLeft) return 'nw';
    if (isTop && isRight) return 'ne';
    if (isBottom && isLeft) return 'sw';
    if (isBottom && isRight) return 'se';
    if (isTop && mouseX >= this.x && mouseX <= this.x + this.width) return 'n';
    if (isBottom && mouseX >= this.x && mouseX <= this.x + this.width) return 's';
    if (isLeft && mouseY >= this.y && mouseY <= this.y + this.height) return 'w';
    if (isRight && mouseY >= this.y && mouseY <= this.y + this.height) return 'e';

    return null;
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
    const headerHeight = WIDGET_LAYOUT.HEADER_HEIGHT;
    
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
    ctx.roundRect(this.x, this.y, this.width, headerHeight, 8);
    ctx.roundRect(this.x, this.y, this.width, headerHeight, 0);
    ctx.fill();

    // Draw Mini Sparkline
    if (this.trades.length > 1) {
      const numPoints = Math.min(SPARKLINE.MAX_POINTS, this.trades.length);
      const points = this.trades.slice(0, numPoints).map(tr => tr.price).reverse();
      
      const maxP = Math.max(...points);
      const minP = Math.min(...points);
      const range = maxP - minP || 1; // Prevent divide by zero if flat
      
      const startX = this.x + SPARKLINE.START_X_OFFSET;
      const endX = this.x + this.width - SPARKLINE.END_X_PADDING;
      const graphW = endX - startX;
      
      if (graphW > SPARKLINE.MIN_WIDTH_TO_DRAW) { // Only draw if widget is wide enough
        const graphH = SPARKLINE.HEIGHT;
        const startY = this.y + SPARKLINE.START_Y_OFFSET;
        
        const isUp = points[points.length - 1] >= points[0];
        const lineColor = isUp ? t.colorBuy : t.colorSell;
        
        ctx.beginPath();
        const coords: [number, number][] = [];
        
        for (let i = 0; i < points.length; i++) {
          const px = startX + (i / (numPoints - 1)) * graphW;
          const py = startY + graphH - ((points[i] - minP) / range) * graphH;
          coords.push([px, py]);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        
        // Stroke the softer line
        ctx.strokeStyle = lineColor + SPARKLINE.LINE_OPACITY_HEX;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = "round";
        ctx.stroke();
        
        // Draw the gradient glow underneath
        ctx.lineTo(coords[coords.length - 1][0], startY + graphH);
        ctx.lineTo(coords[0][0], startY + graphH);
        ctx.closePath();
        
        const grad = ctx.createLinearGradient(0, startY, 0, startY + graphH);
        grad.addColorStop(0, lineColor + SPARKLINE.GLOW_START_HEX);
        grad.addColorStop(1, lineColor + SPARKLINE.GLOW_END_HEX);
        
        ctx.fillStyle = grad;
        ctx.fill();
      }
    }

    // Draw Unified Outline Border
    ctx.beginPath();
    ctx.roundRect(this.x, this.y, this.width, this.height, 8);
    ctx.strokeStyle = isActive ? t.widgetBorderActive : t.widgetBorder;
    ctx.lineWidth = isActive ? 2 : 1;
    ctx.stroke();

    // Draw Title (Symbol)
    ctx.fillStyle = t.textPrimary;
    ctx.font = "bold 15px Inter, sans-serif";
    ctx.textBaseline = "middle";
    const title = this.symbolId === APP_CONFIG.WILDCARD_SYMBOL_ID ? "ALL COINS" : getSymbolName(this.symbolId);
    ctx.fillText(title, this.x + COLUMN_POSITIONS.TIME_X, this.y + headerHeight / 2);
    ctx.textBaseline = "alphabetic"; // Reset to default for the rest of canvas

    // Draw close button 'x' at right side only if active
    if (isActive) {
      ctx.fillStyle = t.textSecondary;
      ctx.font = "14px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("✕", this.x + this.width - 22, this.y + headerHeight / 2);
      ctx.textAlign = "left";
    }

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
      ctx.fillText(trade.timeStr || "", this.x + COLUMN_POSITIONS.TIME_X, drawY);

      let sideX = this.x + COLUMN_POSITIONS.SIDE_NORMAL_X;

      // Symbol Name (Only for ALL COINS widget)
      if (this.symbolId === APP_CONFIG.WILDCARD_SYMBOL_ID) {
        ctx.fillStyle = t.textPrimary;
        const name = getSymbolName(trade.symbolId).split('/')[0]; // Just show 'BTC' instead of 'BTC/IDR' to save space
        ctx.fillText(name, this.x + COLUMN_POSITIONS.SYMBOL_WILDCARD_X, drawY);
        sideX = this.x + COLUMN_POSITIONS.SIDE_WILDCARD_X;
      }

      // Side
      ctx.fillStyle = trade.side === 1 ? t.colorSell : t.colorBuy;
      const sideText = trade.side === 1 ? "SELL" : "BUY ";
      ctx.fillText(sideText, sideX, drawY);

      // Price
      ctx.fillStyle = t.textPrimary;
      ctx.textAlign = "right";
      const priceX = this.symbolId === APP_CONFIG.WILDCARD_SYMBOL_ID ? COLUMN_POSITIONS.PRICE_WILDCARD_X : COLUMN_POSITIONS.PRICE_X;
      ctx.fillText(trade.priceStr || "", this.x + priceX, drawY);

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
