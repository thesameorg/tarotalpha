import { expect, it } from "vitest";
import type { Candle } from "./atr";
import { computeSteps } from "./index";
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
it("computes three steps from a 168-candle snapshot in under 5 ms of CPU (median of 20)", () => {
  const anchorTs = 1789020000000;
  const snapshot = syntheticSnapshot(168, anchorTs);
  const samples: number[] = [];
  for (let i = 0; i < 20; i++) {
    const before = node.cpuUsage();
    const parsed = JSON.parse(JSON.stringify(snapshot)) as Candle[];
    const steps = computeSteps({ asset: "BTCUSDT", anchorTs, snapshot: parsed, steps: 3 });
    const used = node.cpuUsage(before);
    samples.push((used.user + used.system) / 1000);
    expect(steps).toHaveLength(3);
  }
  const sorted = samples.toSorted((a, b) => a - b);
  const median = ((sorted[9] ?? NaN) + (sorted[10] ?? NaN)) / 2;
  console.info(`computeSteps(3 steps, 168 candles) + JSON round trip: median ${median.toFixed(3)} ms CPU over 20 runs`);
  expect(median).toBeLessThan(5);
});
