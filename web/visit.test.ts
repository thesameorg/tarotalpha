import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The theme and Telegram modules touch `window` on import; the visit under test only asks them a question each.
vi.mock("./theme", () => ({ resolvedTheme: (): string => "dark" }));
vi.mock("./telegram", () => ({ telegram: (): null => null }));
vi.mock("./i18n", () => ({ lang: (): string => "ru" }));

const { deviceOf, osOf, sourceOf, visitHeader } = await import("./visit");

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

function fakeStore(): Storage {
  const kept = new Map<string, string>();
  return {
    length: 0,
    clear: (): void => {
      kept.clear();
    },
    getItem: (key: string): string | null => kept.get(key) ?? null,
    key: (): string | null => null,
    removeItem: (key: string): void => {
      kept.delete(key);
    },
    setItem: (key: string, value: string): void => {
      kept.set(key, value);
    },
  };
}

function blockedStore(): Storage {
  const refuse = (): never => {
    throw new Error("storage is blocked");
  };
  const store = fakeStore();
  store.getItem = refuse;
  store.setItem = refuse;
  return store;
}

function browser(stores: { local?: Storage; session?: Storage; agent?: string; referrer?: string } = {}): void {
  vi.stubGlobal("localStorage", stores.local ?? fakeStore());
  vi.stubGlobal("sessionStorage", stores.session ?? fakeStore());
  vi.stubGlobal("navigator", { userAgent: stores.agent ?? MAC });
  vi.stubGlobal("document", { referrer: stores.referrer ?? "" });
  vi.stubGlobal("location", { search: "", host: "tarotalpha.app" });
}

function field(header: string, key: string): string | null {
  return new URLSearchParams(header).get(key);
}

beforeEach(() => {
  browser();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("deviceOf and osOf", () => {
  it("reads the shape of the device off the agent, and nothing else", () => {
    expect(deviceOf(IPHONE)).toBe("mobile");
    expect(deviceOf(MAC)).toBe("desktop");
    expect(osOf(IPHONE)).toBe("iOS");
    expect(osOf(MAC)).toBe("macOS");
    expect(osOf("Mozilla/5.0 (Unknown)")).toBe("other");
  });
});

describe("sourceOf", () => {
  it("names the campaign first, then the site that linked here", () => {
    expect(sourceOf("", "?utm_source=newsletter", "tarotalpha.app")).toBe("newsletter");
    expect(sourceOf("https://news.ycombinator.com/item?id=1", "", "tarotalpha.app")).toBe("news.ycombinator.com");
  });

  it("calls a visit from nowhere, and a click inside the site, direct", () => {
    expect(sourceOf("", "", "tarotalpha.app")).toBe("direct");
    expect(sourceOf("https://tarotalpha.app/r/bcdfghjk", "", "tarotalpha.app")).toBe("direct");
  });
});

describe("visitHeader", () => {
  it("names the same visitor twice and says what the browser is", () => {
    const first = visitHeader();
    const second = visitHeader();

    expect(field(first, "v")).toMatch(/^[0-9a-f]{16}$/);
    expect(field(second, "v")).toBe(field(first, "v"));
    expect(field(first, "s")).toBe(field(second, "s"));
    expect(field(first, "p")).toBe("web");
    expect(field(first, "l")).toBe("ru");
    expect(field(first, "th")).toBe("dark");
    expect(field(first, "d")).toBe("desktop");
    expect(field(first, "src")).toBe("direct");
    expect(Number(field(first, "h"))).toBeGreaterThanOrEqual(0);
    // Outside Telegram there is no client to name, and an empty field is not sent at all.
    expect(field(first, "tp")).toBeNull();
  });

  it("gives a new tab its own session and keeps the visitor", () => {
    const first = visitHeader();
    vi.stubGlobal("sessionStorage", fakeStore());
    const next = visitHeader();

    expect(field(next, "v")).toBe(field(first, "v"));
    expect(field(next, "s")).not.toBe(field(first, "s"));
  });

  it("still counts a browser whose storage is blocked, without merging it with the others", () => {
    browser({ local: blockedStore(), session: blockedStore() });
    const first = visitHeader();
    const second = visitHeader();

    expect(field(first, "v")).toMatch(/^[0-9a-f]{16}$/);
    expect(field(second, "v")).toBe(field(first, "v"));
  });

  it("says nothing rather than throwing when the browser has no crypto", async () => {
    vi.stubGlobal("crypto", {});
    // A fresh copy of the module: the one under test keeps the tokens it already made for this page.
    vi.resetModules();
    const fresh = await import("./visit");

    expect(fresh.visitHeader()).toBe("");
  });

  it("keeps where the visit came from after a click deeper into the site", () => {
    browser({ referrer: "https://t.me/tarotalphabot" });
    const landing = visitHeader();
    vi.stubGlobal("document", { referrer: "https://tarotalpha.app/" });
    const deeper = visitHeader();

    expect(field(landing, "src")).toBe("t.me");
    expect(field(deeper, "src")).toBe("t.me");
  });
});
