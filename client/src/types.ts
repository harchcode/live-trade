export interface Trade {
  timestamp: bigint;
  symbolId: number;
  side: number;
  price: number;
  amount: number;
}

export type TradeSubscriber = (trade: Trade) => void;

const baseCoins = [
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
  if (id < baseCoins.length) {
    return `${baseCoins[id]}/IDR`;
  }
  return `COIN${id}/IDR`;
}
