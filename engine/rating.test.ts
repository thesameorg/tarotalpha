import { describe, expect, it } from "vitest";
import { places, ratings, starsAcross, type Drifts } from "./rating";
import { READER_IDS, type ReaderId } from "./readers";

const [FIRST, SECOND, THIRD, FOURTH, FIFTH] = READER_IDS;
const verdict = (order: readonly ReaderId[]): Drifts => Object.fromEntries(order.map((id, index) => [id, index + 1]));
const always = (order: readonly ReaderId[], times: number): Drifts[] =>
  Array.from({ length: times }, () => verdict(order));
const ratingOf = (verdicts: readonly Drifts[], reader: ReaderId): number =>
  ratings(verdicts).find((entry) => entry.reader === reader)?.rating ?? Number.NaN;

const CLOSEST_FIRST = [FIRST, SECOND, THIRD, FOURTH, FIFTH] as ReaderId[];

describe("places", () => {
  it("gives the whole point to the closest and takes it from the furthest", () => {
    const place = places(verdict(CLOSEST_FIRST) as Required<Drifts>);
    expect(place[FIRST]).toBe(1);
    expect(place[FIFTH]).toBe(-1);
  });

  it("sums to zero: the market of that week is not in the score", () => {
    const place = places(verdict(CLOSEST_FIRST) as Required<Drifts>);
    const total = READER_IDS.reduce((sum, id) => sum + place[id], 0);
    expect(total).toBeCloseTo(0, 12);
  });

  it("reads the size of the gap only as an order", () => {
    const wide = { ...verdict(CLOSEST_FIRST), [FIFTH]: 1000 } as Required<Drifts>;
    expect(places(wide)).toEqual(places(verdict(CLOSEST_FIRST) as Required<Drifts>));
  });
});

describe("ratings", () => {
  it("has nobody ahead before a single reading has been scored", () => {
    for (const entry of ratings([])) {
      expect(entry).toMatchObject({ rating: 0, stars: 3, wins: 0, verdicts: 0 });
    }
  });

  it("walks a reader to the top of the scale when she keeps winning and the last one to the bottom", () => {
    const table = ratings(always(CLOSEST_FIRST, 60));
    expect(table.find((entry) => entry.reader === FIRST)).toMatchObject({ stars: 4.5, wins: 1, verdicts: 60 });
    expect(table.find((entry) => entry.reader === FIFTH)?.stars).toBe(1.5);
  });

  it("lets a rating fall back: yesterday's wins fade as new readings land", () => {
    const risen = always(CLOSEST_FIRST, 60);
    const fallen = [...risen, ...always([...CLOSEST_FIRST].reverse(), 20)];
    expect(ratingOf(fallen, FIRST)).toBeLessThan(ratingOf(risen, FIRST) - 0.5);
  });

  it("weighs the newest readings most: the same wins later count for more", () => {
    const early = [...always(CLOSEST_FIRST, 5), ...always([...CLOSEST_FIRST].reverse(), 30)];
    const late = [...always([...CLOSEST_FIRST].reverse(), 30), ...always(CLOSEST_FIRST, 5)];
    expect(ratingOf(late, FIRST)).toBeGreaterThan(ratingOf(early, FIRST));
  });

  it("counts a win only when nobody at the table was closer", () => {
    const mixed = [...always(CLOSEST_FIRST, 3), ...always([SECOND, FIRST, THIRD, FOURTH, FIFTH], 1)];
    expect(ratings(mixed).find((entry) => entry.reader === FIRST)?.wins).toBeCloseTo(0.75, 12);
  });

  it("throws away a verdict that cannot place everyone at the table", () => {
    const half = { [FIRST]: 1, [SECOND]: 2 } as Drifts;
    expect(ratings([half, ...always(CLOSEST_FIRST, 2)])[0]?.verdicts).toBe(2);
  });
});

describe("starsAcross", () => {
  it("puts a table nobody has scored on three stars each", () => {
    expect(starsAcross([0, 0, 0, 0, 0])).toEqual([3, 3, 3, 3, 3]);
  });

  it("spreads an evenly ordered table across the scale in halves", () => {
    expect(starsAcross([1, 0.5, 0, -0.5, -1])).toEqual([4.5, 3.5, 3, 2.5, 1.5]);
  });

  it("keeps the fifth star for a reader clear of the rest", () => {
    expect(starsAcross([1, -0.25, -0.25, -0.25, -0.25])[0]).toBe(5);
  });

  it("never drops below one star", () => {
    expect(starsAcross([-1, 0.25, 0.25, 0.25, 0.25])[0]).toBe(1);
  });

  it("reads the distances between readers, not their size", () => {
    expect(starsAcross([0.02, 0.01, 0, -0.01, -0.02])).toEqual(starsAcross([2, 1, 0, -1, -2]));
  });
});
