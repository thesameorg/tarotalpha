import { describe, expect, it } from "vitest";
import { MAX_STEPS } from "../engine/index";
import { DAY_COST, dayCost, MANA_CAPACITY, parseTank, settle, spend, type Tank } from "./mana";

// Local wall clock, so the midnight refill is tested the same in every timezone the suite runs in.
const at = (day: number, hour: number, minute = 0): number => new Date(2026, 8, day, hour, minute).getTime();
const full = (now: number): Tank => ({ mana: MANA_CAPACITY, at: now });

function pay(tank: Tank, cost: number, now: number): Tank {
  const next = spend(tank, cost, now);
  if (next === null) throw new Error(`could not pay ${String(cost)}`);
  return next;
}

describe("day cost", () => {
  it("prices every day up to the horizon and none past it", () => {
    expect(DAY_COST).toHaveLength(MAX_STEPS);
    expect(Array.from({ length: MAX_STEPS }, (_, i) => dayCost(i + 1))).toEqual([1, 1, 1, 2, 2, 2, 3]);
    expect(() => dayCost(MAX_STEPS + 1)).toThrow(RangeError);
  });

  it("charges nothing for a day of the same reading already paid for, and the full price past it", () => {
    expect(dayCost(1, 3)).toBe(0);
    expect(dayCost(3, 3)).toBe(0);
    expect(dayCost(4, 3)).toBe(2);
  });

  it("lets a full tank open six days of one reading, not the seventh", () => {
    let tank = full(at(11, 10));
    for (let day = 1; day <= 6; day++) tank = pay(tank, dayCost(day), at(11, 10));
    expect(tank.mana).toBe(MANA_CAPACITY - 9);
    expect(spend(tank, dayCost(7), at(11, 10))).toBeNull();
  });
});

describe("refill", () => {
  it("gives a point back after an hour, and nothing for part of one", () => {
    const drained = pay(full(at(11, 10)), 5, at(11, 10));
    expect(settle(drained, at(11, 10, 59)).mana).toBe(5);
    expect(settle(drained, at(11, 11)).mana).toBe(6);
    expect(settle(drained, at(11, 13, 30)).mana).toBe(8);
  });

  it("keeps the part of an hour already waited across a spend", () => {
    const drained = pay(full(at(11, 10)), 5, at(11, 10));
    const again = pay(drained, 1, at(11, 10, 40));
    expect(settle(again, at(11, 11)).mana).toBe(5);
  });

  it("starts the clock on the first spend from a full tank, not on the last refill", () => {
    const rested = full(at(11, 8));
    const spent = pay(rested, 1, at(11, 10, 30));
    expect(settle(spent, at(11, 11)).mana).toBe(MANA_CAPACITY - 1);
    expect(settle(spent, at(11, 11, 30)).mana).toBe(MANA_CAPACITY);
  });

  it("never fills past the capacity", () => {
    const drained = pay(full(at(11, 10)), 2, at(11, 10));
    expect(settle(drained, at(11, 20)).mana).toBe(MANA_CAPACITY);
  });

  it("fills to the brim with a new local day, even ten minutes past midnight", () => {
    const empty = pay(full(at(11, 23, 30)), MANA_CAPACITY, at(11, 23, 30));
    expect(settle(empty, at(11, 23, 59)).mana).toBe(0);
    expect(settle(empty, at(12, 0, 10)).mana).toBe(MANA_CAPACITY);
  });

  it("refuses a day it cannot pay for and leaves the tank as it was", () => {
    const low = pay(full(at(11, 10)), 9, at(11, 10));
    expect(spend(low, 2, at(11, 10, 30))).toBeNull();
    expect(pay(low, 2, at(11, 11)).mana).toBe(0);
  });
});

describe("stored tank", () => {
  it("reads what was written", () => {
    const tank = { mana: 4, at: at(11, 10) };
    expect(parseTank(JSON.stringify(tank), at(11, 12))).toEqual(tank);
  });

  it("starts full when nothing readable is stored", () => {
    const now = at(11, 10);
    for (const raw of [null, "", "not json", "{}", '{"mana":"5","at":1}', '{"mana":-1,"at":1}', "null"]) {
      expect(parseTank(raw, now)).toEqual(full(now));
    }
  });
});
