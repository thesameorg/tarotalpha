/**
 * Closed 1H candles straight from the exchange — the same code runs in the browser and in the Worker.
 * Nothing is cached anywhere: a snapshot exists only inside a saved reading.
 * Why the anchor is the last closed candle and why there is no cache: docs/flows/candles-from-exchange.md
 */
import type { Candle } from "../engine/v1/atr";
import { binance } from "./binance";
import { bybit } from "./bybit";
import { ExchangeError, type Provider, type Source } from "./provider";

export const HOUR_MS = 3_600_000;
export const SNAPSHOT_LENGTH = 168;
export const ASSET_PATTERN = /^[A-Z0-9]{2,20}$/;
export const SOURCES: readonly Source[] = ["bybit", "binance"];

// Bybit first: it answers from both the browser and the Cloudflare edge; Binance blocks the edge (403).
const PROVIDERS: readonly Provider[] = [bybit, binance];

export interface Snapshot {
  source: Source;
  anchorTs: number;
  candles: Candle[];
}

export function lastClosedAnchor(nowMs: number): number {
  return Math.floor(nowMs / HOUR_MS) * HOUR_MS - HOUR_MS;
}

export function isHourAligned(ts: number): boolean {
  return Number.isInteger(ts) && ts % HOUR_MS === 0;
}

/** 168 candles ending exactly at the anchor. Providers are tried in the given order; the last failure is rethrown. */
export async function fetchSnapshot(
  asset: string,
  anchorTs: number,
  sources: readonly Source[] = SOURCES,
): Promise<Snapshot> {
  const failures: ExchangeError[] = [];
  for (const source of sources) {
    const provider = providerFor(source);
    try {
      const candles = await provider.klines({ asset, endTs: anchorTs + HOUR_MS - 1, limit: SNAPSHOT_LENGTH });
      assertEndsAtAnchor(candles, anchorTs, source);
      return { source, anchorTs, candles };
    } catch (error) {
      if (!(error instanceof ExchangeError)) throw error;
      failures.push(error);
    }
  }
  // An exchange that answered (unknown symbol, short history) beats one that did not answer at all.
  const answered = failures.find((failure) => failure.kind !== "unavailable");
  throw (
    answered ?? failures[failures.length - 1] ?? new ExchangeError("unavailable", null, "no exchange sources given")
  );
}

/** Closed candles after the anchor, at most `limit`, from the snapshot's own provider so accuracy compares like with like. */
export async function fetchAfter(
  asset: string,
  anchorTs: number,
  limit: number,
  source: Source,
  nowMs: number,
): Promise<Candle[]> {
  const startTs = anchorTs + HOUR_MS;
  const candles = await providerFor(source).klines({ asset, startTs, endTs: startTs + limit * HOUR_MS - 1, limit });
  return candles.filter((candle) => candle.t >= startTs && candle.t + HOUR_MS <= nowMs);
}

function providerFor(source: Source): Provider {
  const provider = PROVIDERS.find((candidate) => candidate.source === source);
  if (provider === undefined) throw new RangeError(`unknown exchange source: ${source}`);
  return provider;
}

function assertEndsAtAnchor(candles: readonly Candle[], anchorTs: number, source: Source): void {
  const last = candles[candles.length - 1];
  if (candles.length !== SNAPSHOT_LENGTH || last?.t !== anchorTs) {
    const tail = last === undefined ? "nothing" : String(last.t);
    throw new ExchangeError(
      "too_old",
      source,
      `expected ${String(SNAPSHOT_LENGTH)} candles ending at ${String(anchorTs)}, got ${String(candles.length)} ending at ${tail}`,
    );
  }
}
