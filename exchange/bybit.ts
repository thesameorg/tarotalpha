/** Bybit spot klines, first in the queue: it answers the browser and the Worker alike. Limits: docs/exchange.md */
import type { Candle } from "../engine/atr";
import { DEADLINE_MS, ExchangeError, type KlineWindow, type Provider } from "./provider";

const KLINE_URL = "https://api.bybit.com/v5/market/kline";
const PARAMS_ERROR_CODE = 10001;

interface KlineBody {
  retCode?: number;
  retMsg?: string;
  result?: { list?: unknown[] };
}

export const bybit: Provider = {
  source: "bybit",
  async klines({ asset, startTs, endTs, limit }: KlineWindow): Promise<Candle[]> {
    const url = new URL(KLINE_URL);
    url.searchParams.set("category", "spot");
    url.searchParams.set("symbol", asset);
    url.searchParams.set("interval", "60");
    url.searchParams.set("limit", String(limit));
    if (startTs !== undefined) url.searchParams.set("start", String(startTs));
    if (endTs !== undefined) url.searchParams.set("end", String(endTs));

    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(DEADLINE_MS) });
    } catch (error) {
      throw new ExchangeError("unavailable", "bybit", `network failure: ${String(error)}`);
    }
    if (!response.ok) throw new ExchangeError("unavailable", "bybit", `HTTP ${String(response.status)}`);
    // A body that is not JSON, or one cut off by the deadline, reads as no retCode: unavailable, next provider.
    const body = (await response.json().catch(() => ({}))) as KlineBody;
    if (body.retCode === PARAMS_ERROR_CODE)
      throw new ExchangeError("unknown_asset", "bybit", `unknown symbol ${asset}`);
    if (body.retCode !== 0)
      throw new ExchangeError("unavailable", "bybit", `retCode ${String(body.retCode)}: ${body.retMsg ?? ""}`);
    const list = body.result?.list;
    if (!Array.isArray(list)) throw new ExchangeError("unavailable", "bybit", "unexpected body");
    // Bybit lists newest first; every consumer wants time ascending.
    return list.map(parseRow).reverse();
  },
};

// Row: [startTime, open, high, low, close, volume, turnover]; everything arrives as strings.
function parseRow(row: unknown): Candle {
  if (!Array.isArray(row) || row.length < 5) throw new ExchangeError("unavailable", "bybit", "unexpected row");
  const [t, o, h, l, c] = row as [string, string, string, string, string];
  return { t: Number(t), o: Number(o), h: Number(h), l: Number(l), c: Number(c) };
}
