import { describe, expect, it, vi } from "vitest";

// The theme module touches `window` on import; the launch parsing under test never reaches it.
vi.mock("./theme", () => ({ bindSystemScheme: (): void => undefined, onThemeChange: (): void => undefined }));

const { launchedByTelegram, startReadingOf } = await import("./telegram");

const LAUNCH = "#tgWebAppData=query_id%3DAAH&tgWebAppVersion=9.0&tgWebAppPlatform=weba&tgWebAppThemeParams=%7B%7D";

describe("launchedByTelegram", () => {
  it("sees the launch hash", () => {
    expect(launchedByTelegram(LAUNCH, null)).toBe(true);
  });

  it("remembers the launch once the hash is gone", () => {
    expect(launchedByTelegram("", "telegram")).toBe(true);
  });

  it("is false for a plain visit", () => {
    expect(launchedByTelegram("", null)).toBe(false);
    expect(launchedByTelegram("#section", null)).toBe(false);
  });

  it("wants initData, not the platform alone", () => {
    expect(launchedByTelegram("#tgWebAppPlatform=weba&tgWebAppVersion=9.0", null)).toBe(false);
    expect(launchedByTelegram("#tgWebAppPlatform=weba&tgWebAppData=", null)).toBe(false);
  });
});

describe("startReadingOf", () => {
  it("takes the reading id from the launch hash", () => {
    expect(startReadingOf(`${LAUNCH}&tgWebAppStartParam=Ab3_-9xZ`, undefined)).toBe("Ab3_-9xZ");
  });

  it("takes it from initData when the client puts it only there", () => {
    expect(startReadingOf(LAUNCH, "Ab3_-9xZ")).toBe("Ab3_-9xZ");
  });

  it("ignores anything that is not a reading id", () => {
    expect(startReadingOf(`${LAUNCH}&tgWebAppStartParam=..%2Fx`, undefined)).toBeNull();
    expect(startReadingOf(LAUNCH, "../x")).toBeNull();
    expect(startReadingOf(LAUNCH, undefined)).toBeNull();
  });

  it("does not replay the parameter on a reload, when the launch hash is gone", () => {
    expect(startReadingOf("", "Ab3_-9xZ")).toBeNull();
  });
});
