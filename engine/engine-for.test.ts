import { describe, expect, it } from "vitest";
import { engineFor, ENGINES } from "./index";
import { computeSteps, ENGINE_VERSION } from "./v1/index";

describe("engine registry", () => {
  it("resolves the version a reading stores to that engine", () => {
    expect(engineFor("v1").version).toBe(ENGINE_VERSION);
    expect(engineFor("v1").computeSteps).toBe(computeSteps);
    expect(Object.keys(ENGINES)).toEqual(["v1"]);
  });

  it("refuses an unknown version instead of guessing", () => {
    expect(() => engineFor("v0")).toThrow(RangeError);
    expect(() => engineFor("constructor")).toThrow(RangeError);
  });
});
