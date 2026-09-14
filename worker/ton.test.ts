import { describe, expect, it } from "vitest";
import { COINS, type Coin } from "./coins";
import { findPayment, quote, type TonApi } from "./ton";

const OURS = "0:fda80d4c94d0c500cfa854014f11126599e385e8397a04b23712d4b8068a550b";
const THEM = "0:1111111111111111111111111111111111111111111111111111111111111111";
const COMMENT = "ta0123456789abcdef";

function coin(id: string): Coin {
  const found = COINS.find((c) => c.id === id);
  if (found === undefined) throw new Error(`no coin ${id}`);
  return found;
}

const USDT = coin("usdt");
const GRAM = coin("gram");

/** tonapi with a scripted answer: `findPayment` takes its client as an argument, so no network is involved. */
function api(events: unknown[]): TonApi {
  return {
    accounts: {
      getAccount: () => Promise.resolve({ address: OURS }),
      getAccountEvents: () => Promise.resolve({ events }),
    },
  } as unknown as TonApi;
}

function event(action: unknown, { settling = false } = {}): unknown {
  return { event_id: "evt-1", in_progress: settling, actions: [action] };
}

function gramTransfer({ to = OURS, comment = COMMENT, amount = 7_000_000_000, status = "ok" } = {}): unknown {
  return { type: "TonTransfer", status, TonTransfer: { recipient: { address: to }, amount, comment } };
}

function jetton({ to = OURS, comment = COMMENT, amount = "4990000", master = USDT.master, symbol = "USD₮" } = {}) {
  return {
    type: "JettonTransfer",
    status: "ok",
    JettonTransfer: {
      recipient: { address: to },
      amount,
      comment,
      jetton: { address: master, symbol, decimals: 6 },
    },
  };
}

describe("finding the payment that settles an offer", () => {
  it("finds the network's own coin by its comment", async () => {
    const found = await findPayment(api([event(gramTransfer())]), OURS, COMMENT, GRAM);
    expect(found).toEqual({ units: 7_000_000_000n, hash: "evt-1" });
  });

  it("finds a jetton and reads the amount in the jetton's own units", async () => {
    const found = await findPayment(api([event(jetton())]), OURS, COMMENT, USDT);
    expect(found?.units).toBe(4_990_000n);
  });

  it("refuses a forgery that copies the ticker but not the master contract", async () => {
    const fake = jetton({ master: THEM, symbol: "USD₮" });
    expect(await findPayment(api([event(fake)]), OURS, COMMENT, USDT)).toBeNull();
  });

  it("does not take a jetton payment for a Gram offer, or the other way round", async () => {
    expect(await findPayment(api([event(jetton())]), OURS, COMMENT, GRAM)).toBeNull();
    expect(await findPayment(api([event(gramTransfer())]), OURS, COMMENT, USDT)).toBeNull();
  });

  it("ignores what left us, what carries another comment and what is still settling", async () => {
    expect(await findPayment(api([event(gramTransfer({ to: THEM }))]), OURS, COMMENT, GRAM)).toBeNull();
    // We send this stablecoin out too, and an outgoing transfer carries a comment just the same.
    expect(await findPayment(api([event(jetton({ to: THEM }))]), OURS, COMMENT, USDT)).toBeNull();
    expect(await findPayment(api([event(gramTransfer({ comment: "ta9999" }))]), OURS, COMMENT, GRAM)).toBeNull();
    expect(await findPayment(api([event(gramTransfer(), { settling: true })]), OURS, COMMENT, GRAM)).toBeNull();
    expect(await findPayment(api([event(gramTransfer({ status: "failed" }))]), OURS, COMMENT, GRAM)).toBeNull();
  });

  it("ignores dust, which is what actually arrives in Gram unasked", async () => {
    // Real dust carries no comment at all, so the field is absent rather than empty.
    const dust = event({
      type: "TonTransfer",
      status: "ok",
      TonTransfer: { recipient: { address: OURS }, amount: 100_000 },
    });
    expect(await findPayment(api([dust]), OURS, COMMENT, GRAM)).toBeNull();
  });

  it("picks the payment out of a busy history", async () => {
    const events = [
      event(gramTransfer({ comment: "ta0000" })),
      event(jetton({ comment: "taffff" })),
      { event_id: "evt-hit", in_progress: false, actions: [jetton()] },
    ];
    expect((await findPayment(api(events), OURS, COMMENT, USDT))?.hash).toBe("evt-hit");
  });
});

describe("quoting a price", () => {
  it("needs no rate for a coin that is already a dollar", async () => {
    const never = api([]);
    expect(await quote(never, USDT, 499)).toBe(4_990_000n);
    expect(await quote(never, USDT, 199)).toBe(1_990_000n);
  });

  it("turns cents into the coin's units at the rate it is given", async () => {
    const rated = {
      rates: { getRates: () => Promise.resolve({ rates: { GRAM: { prices: { USD: 2 } } } }) },
    } as unknown as TonApi;
    // $4.99 at two dollars a coin is 2.495 of it, and a coin of nine decimals counts in billionths.
    expect(await quote(rated, GRAM, 499)).toBe(2_495_000_000n);
  });

  it("refuses to price anything when the rate is missing or nonsense", async () => {
    const broken = { rates: { getRates: () => Promise.resolve({ rates: {} }) } } as unknown as TonApi;
    await expect(quote(broken, GRAM, 499)).rejects.toThrow(/no usd rate/);
    const zero = {
      rates: { getRates: () => Promise.resolve({ rates: { GRAM: { prices: { USD: 0 } } } }) },
    } as unknown as TonApi;
    await expect(quote(zero, GRAM, 499)).rejects.toThrow(/no usd rate/);
  });
});
