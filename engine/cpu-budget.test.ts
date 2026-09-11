import { expect, it } from "vitest";
import type { Candle } from "./atr";
import { computeSteps, deviation, forecastFromCards, natr, READER_IDS, type ReaderId } from "./index";
import { makeRng } from "./seed";

interface CpuUsage {
  user: number;
  system: number;
}

// The engine's tsconfigs describe the browser and the Worker; this test runs in Node and reads its process there.
const { process: node } = globalThis as unknown as { process: { cpuUsage(previous?: CpuUsage): CpuUsage } };

function syntheticSnapshot(count: number, anchorTs: number): Candle[] {
  const r = makeRng("cpu-budget");
  const out: Candle[] = [];
  let price = 62000;
  for (let i = 0; i < count; i++) {
    const o = price;
    const c = o + (r() - 0.5) * o * 0.012;
    out.push({
      t: anchorTs - (count - 1 - i) * 3_600_000,
      o,
      h: Math.max(o, c) + r() * o * 0.004,
      l: Math.min(o, c) - r() * o * 0.004,
      c,
    });
    price = c;
  }
  return out;
}

// Cloudflare's free plan gives a request 10 ms of CPU; a reading must fit with room for JSON and D1 on top.
// Every reader is measured: a mechanic that searches or transforms the snapshot must stay inside the same budget.
it.each(READER_IDS)("computes three %s steps from a 168-candle snapshot in under 5 ms of CPU", (reader: ReaderId) => {
  const anchorTs = 1789020000000;
  const snapshot = syntheticSnapshot(168, anchorTs);
  const samples: number[] = [];
  for (let i = 0; i < 20; i++) {
    const before = node.cpuUsage();
    const parsed = JSON.parse(JSON.stringify(snapshot)) as Candle[];
    const steps = computeSteps({ asset: "BTCUSDT", anchorTs, snapshot: parsed, reader, steps: 3 });
    const used = node.cpuUsage(before);
    samples.push((used.user + used.system) / 1000);
    expect(steps).toHaveLength(3);
  }
  const sorted = samples.toSorted((a, b) => a - b);
  const median = ((sorted[9] ?? NaN) + (sorted[10] ?? NaN)) / 2;
  console.info(`${reader}: 3 steps over 168 candles + JSON round trip, median ${median.toFixed(3)} ms CPU of 20 runs`);
  expect(median).toBeLessThan(5);
});

// The sweep scores a whole table on one reading, and it runs on a Cron Trigger with the same 10 ms of CPU. The sweep
// is sized from the measured cost, about a millisecond (docs/flows/reading-lifecycle.md); the ceiling here is a
// regression guard with the same headroom as the step tests, so a slow CI runner (2.0 ms seen) does not trip it.
it("scores one reading for all five readers in under 5 ms of CPU", () => {
  const anchorTs = 1789020000000;
  const snapshot = syntheticSnapshot(168, anchorTs);
  const cards = computeSteps({ asset: "BTCUSDT", anchorTs, snapshot, reader: "atr", steps: 2 }).map(
    (step) => step.cards,
  );
  const real = syntheticSnapshot(48, anchorTs).map((candle, i) => ({ ...candle, t: anchorTs + (i + 1) * 3_600_000 }));
  const samples: number[] = [];
  for (let i = 0; i < 20; i++) {
    const before = node.cpuUsage();
    const parsed = JSON.parse(JSON.stringify(snapshot)) as Candle[];
    const unit = natr(parsed);
    for (const reader of READER_IDS) {
      const forecast = forecastFromCards({ asset: "BTCUSDT", anchorTs, snapshot: parsed, reader, cards }).flatMap(
        (step) => step.candles,
      );
      expect(deviation(forecast, real, unit).compared).toBe(48);
    }
    const used = node.cpuUsage(before);
    samples.push((used.user + used.system) / 1000);
  }
  const sorted = samples.toSorted((a, b) => a - b);
  const median = ((sorted[9] ?? NaN) + (sorted[10] ?? NaN)) / 2;
  console.info(`one reading, five readers, median ${median.toFixed(3)} ms CPU of 20 runs`);
  expect(median).toBeLessThan(5);
});
