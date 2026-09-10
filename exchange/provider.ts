/** What every exchange adapter gives: 1H candles in one shape, and one error vocabulary the UI can show. */
import type { Candle } from "../engine/atr";

export type Source = "binance" | "bybit";
export type ExchangeErrorKind = "unknown_asset" | "unavailable" | "too_old";

export class ExchangeError extends Error {
  constructor(
    readonly kind: ExchangeErrorKind,
    readonly source: Source | null,
    message: string,
  ) {
    super(message);
    this.name = "ExchangeError";
  }
}

export interface KlineWindow {
  asset: string;
  startTs?: number;
  endTs?: number;
  limit: number;
}

export interface Provider {
  readonly source: Source;
  /** Ascending candles inside the window, closed or not — the caller decides what counts as closed. */
  klines(window: KlineWindow): Promise<Candle[]>;
}
