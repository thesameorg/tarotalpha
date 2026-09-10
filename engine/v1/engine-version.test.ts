import { expect, it } from "vitest";
import { ENGINE_VERSION } from "./index";

it("names the engine version that is stored next to every reading", () => {
  expect(ENGINE_VERSION).toBe("v1");
});
