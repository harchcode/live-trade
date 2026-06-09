export interface Trade {
  timestamp: bigint;
  symbolId: number;
  side: number;
  price: number;
  amount: number;
}

export type TradeSubscriber = (trade: Trade) => void;
