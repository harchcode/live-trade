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

export { getSymbolName } from "./constants";
