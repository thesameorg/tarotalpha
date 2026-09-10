/** Binance spot klines, the primary provider. Response format and limits: docs/reference/binance-klines.md */
import type { Candle } from "../engine/atr";
import { ExchangeError, type KlineWindow, type Provider } from "./provider";

const KLINES_URL = "https://api.binance.com/api/v3/klines";
const INVALID_SYMBOL_CODE = -1121;

export const binance: Provider = {
  source: "binance",
  async klines({ asset, startTs, endTs, limit }: KlineWindow): Promise<Candle[]> {
    const url = new URL(KLINES_URL);
    url.searchParams.set("symbol", asset);
    url.searchParams.set("interval", "1h");
    url.searchParams.set("limit", String(limit));
    if (startTs !== undefined) url.searchParams.set("startTime", String(startTs));
    if (endTs !== undefined) url.searchParams.set("endTime", String(endTs));

    let response: Response;
    try {
      response = await fetch(url);
    } catch (error) {
      throw new ExchangeError("unavailable", "binance", `network failure: ${String(error)}`);
    }
    if (response.status === 400) {
      const body = (await response.json().catch(() => null)) as { code?: number } | null;
      if (body?.code === INVALID_SYMBOL_CODE)
        throw new ExchangeError("unknown_asset", "binance", `unknown symbol ${asset}`);
      throw new ExchangeError("unavailable", "binance", `bad request: ${JSON.stringify(body)}`);
    }
    if (!response.ok) throw new ExchangeError("unavailable", "binance", `HTTP ${String(response.status)}`);
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) throw new ExchangeError("unavailable", "binance", "unexpected body");
    return rows.map(parseRow);
  },
};

// Row: [openTime, open, high, low, close, volume, closeTime, ...]; prices arrive as strings.
function parseRow(row: unknown): Candle {
  if (!Array.isArray(row) || row.length < 5) throw new ExchangeError("unavailable", "binance", "unexpected row");
  const [t, o, h, l, c] = row as [number, string, string, string, string];
  return { t, o: Number(o), h: Number(h), l: Number(l), c: Number(c) };
}
