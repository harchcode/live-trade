export const APP_CONFIG = {
  MAX_WIDGETS: 50,
  WILDCARD_SYMBOL_ID: 65535,
  WS_URL: "ws://localhost:8080",
  TRADE_BYTE_SIZE: 27,
  FPS_THROTTLE_MS: 1000
};

export const WIDGET_LAYOUT = {
  MIN_WIDTH_NORMAL: 250,
  MIN_WIDTH_WILDCARD: 310,
  MIN_HEIGHT: 200,
  HEADER_HEIGHT: 44,
  MAX_ROWS: 100,
  INSET: 8,
  MAX_SCROLL_ROWS: 100,
  ROW_HEIGHT: 24,
};

export const COLUMN_POSITIONS = {
  TIME_X: 16,
  SYMBOL_WILDCARD_X: 95,
  SIDE_NORMAL_X: 90,
  SIDE_WILDCARD_X: 155,
  PRICE_X: 245 // anchor for right alignment
};

export const SPARKLINE = {
  MAX_POINTS: 50,
  HEIGHT: 24,
  START_Y_OFFSET: 10,
  START_X_OFFSET: 110,
  END_X_PADDING: 40,
  MIN_WIDTH_TO_DRAW: 20,
  LINE_OPACITY_HEX: "55",
  GLOW_START_HEX: "40",
  GLOW_END_HEX: "00",
};

export const BASE_COINS = [
  "BTC",
  "ETH",
  "USDT",
  "BNB",
  "XRP",
  "SOL",
  "ADA",
  "DOGE",
  "TRX",
  "LINK"
];

export function getSymbolName(id: number): string {
  if (id < BASE_COINS.length) {
    return `${BASE_COINS[id]}/IDR`;
  }
  return `COIN${id}/IDR`;
}
