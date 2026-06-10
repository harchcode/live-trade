import type { Trade, TradeSubscriber } from "./types";
import { APP_CONFIG } from "./constants";

export class WSManager {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private heartbeatInterval: number | null = null;

  // Track active subscriptions internally to re-subscribe on reconnect
  private activeSubscriptions = new Set<number>();

  // Pub/Sub listeners: Map<SymbolID, Set<Callback>>
  private listeners = new Map<number, Set<TradeSubscriber>>();

  public totalBytesReceived = 0;
  public totalTradesReceived = 0;
  public onStatusChange?: (status: "connected" | "reconnecting") => void;

  constructor(url: string) {
    this.url = url;
    this.connect();
  }

  private connect() {
    console.log("[WS] Connecting to server...");
    this.ws = new WebSocket(this.url);
    this.ws.binaryType = "arraybuffer"; // Crucial for DataView parsing

    this.ws.onopen = () => {
      console.log("[WS] Connected");
      this.onStatusChange?.("connected");
      this.resetHeartbeat();

      // Re-subscribe to previously active subscriptions (useful on reconnect)
      for (const symbolId of this.activeSubscriptions) {
        this.sendSubscriptionCommand(0, symbolId);
      }
    };

    this.ws.onmessage = event => {
      this.resetHeartbeat(); // Any message from server resets silence timer

      if (event.data instanceof ArrayBuffer) {
        const buffer = event.data;
        this.totalBytesReceived += buffer.byteLength;

        // Check if it's a manual Pong (1 byte, Action = 3)
        if (buffer.byteLength === 1) {
          const view = new DataView(buffer);
          if (view.getUint8(0) === 3) return; // Pong received, heartbeat reset
        }

        const view = new DataView(buffer);
        // Trades buffer length must be a multiple of TRADE_SIZE
        if (buffer.byteLength % APP_CONFIG.TRADE_BYTE_SIZE !== 0) {
          console.warn(
            "[WS] Received malformed binary data length:",
            buffer.byteLength
          );
          return;
        }

        const numTrades = buffer.byteLength / APP_CONFIG.TRADE_BYTE_SIZE;
        this.totalTradesReceived += numTrades;
        let offset = 0;

        const tradesBySymbol = new Map<number, Trade[]>();

        for (let i = 0; i < numTrades; i++) {
          const timestamp = view.getBigUint64(offset, true);
          offset += 8;
          const symbolId = view.getUint16(offset, true);
          offset += 2;
          const side = view.getUint8(offset);
          offset += 1;
          const price = view.getFloat64(offset, true);
          offset += 8;
          const amount = view.getFloat64(offset, true);
          offset += 8;
          
          const timeStr = new Date(Number(timestamp)).toLocaleTimeString([], {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
          });
          const priceStr = price.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          });
          const amountStr = amount.toLocaleString(undefined, {
            minimumFractionDigits: 4,
            maximumFractionDigits: 4
          });

          const trade: Trade = { timestamp, symbolId, side, price, amount, timeStr, priceStr, amountStr };
          
          if (!tradesBySymbol.has(symbolId)) {
            tradesBySymbol.set(symbolId, []);
          }
          tradesBySymbol.get(symbolId)!.push(trade);
        }
        
        for (const [symbolId, trades] of tradesBySymbol.entries()) {
          // Dispatch to specific symbol listeners
          const symbolListeners = this.listeners.get(symbolId);
          if (symbolListeners) {
            for (const listener of symbolListeners) {
              listener(trades);
            }
          }
          // Dispatch to "ALL COINS" wildcard listeners
          const allListeners = this.listeners.get(APP_CONFIG.WILDCARD_SYMBOL_ID);
          if (allListeners) {
            for (const listener of allListeners) {
              listener(trades);
            }
          }
        }
      }
    };

    this.ws.onclose = () => {
      console.log("[WS] Disconnected. Attempting reconnect...");
      this.onStatusChange?.("reconnecting");
      this.clearTimers();
      this.scheduleReconnect();
    };

    this.ws.onerror = err => {
      console.error("[WS] Error:", err);
      // Close will trigger onclose which handles reconnect
      this.ws?.close();
    };
  }

  private sendSubscriptionCommand(action: number, symbolId: number) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const buffer = new ArrayBuffer(3);
      const view = new DataView(buffer);
      view.setUint8(0, action); // 0 = Subscribe, 1 = Unsubscribe
      view.setUint16(1, symbolId, true); // Little Endian
      this.ws.send(buffer);
    }
  }

  public subscribe(symbolId: number, callback: TradeSubscriber) {
    if (!this.listeners.has(symbolId)) {
      this.listeners.set(symbolId, new Set());
    }
    this.listeners.get(symbolId)!.add(callback);

    if (!this.activeSubscriptions.has(symbolId)) {
      this.activeSubscriptions.add(symbolId);
      this.sendSubscriptionCommand(0, symbolId);
    }
  }

  public unsubscribe(symbolId: number, callback: TradeSubscriber) {
    const symbolListeners = this.listeners.get(symbolId);
    if (symbolListeners) {
      symbolListeners.delete(callback);
      if (symbolListeners.size === 0) {
        this.activeSubscriptions.delete(symbolId);
        this.sendSubscriptionCommand(1, symbolId);
      }
    }
  }

  private dispatchTrades(symbolId: number, trades: Trade[]) {
    const symbolListeners = this.listeners.get(symbolId);
    if (symbolListeners) {
      for (const listener of symbolListeners) {
        listener(trades);
      }
    }
  }

  private resetHeartbeat() {
    this.clearTimers();

    // Client Ping logic: "Send ping after 2s of silence"
    this.heartbeatTimer = window.setTimeout(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendManualPing();

        // "...then every 10s after that"
        this.heartbeatInterval = window.setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.sendManualPing();
          }
        }, 10000);
      }
    }, 2000);
  }

  private sendManualPing() {
    const buffer = new ArrayBuffer(1);
    new DataView(buffer).setUint8(0, 2); // Action 2 = Ping
    this.ws!.send(buffer);
  }

  private scheduleReconnect() {
    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, 3000);
  }

  private clearTimers() {
    if (this.heartbeatTimer !== null) window.clearTimeout(this.heartbeatTimer);
    if (this.heartbeatInterval !== null)
      window.clearInterval(this.heartbeatInterval);
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.heartbeatTimer = null;
    this.heartbeatInterval = null;
    this.reconnectTimer = null;
  }
}
