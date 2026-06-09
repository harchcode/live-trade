export interface Trade {
  timestamp: bigint;
  symbolId: number;
  side: number;
  price: number;
  amount: number;
  timeStr?: string;
  priceStr?: string;
  amountStr?: string;
}

export type TradeSubscriber = (trades: Trade[]) => void;

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
