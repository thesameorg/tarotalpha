/** Test helper: one Worker call against the real handler with the test bindings. */
import { env } from "cloudflare:workers";
import worker from "./index";
import type { PaymentSecrets } from "./wallet";

const ORIGIN = "https://tarotalpha.test";
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
export type Init = RequestInit<IncomingRequestCfProperties>;

export async function callApi(
  path: string,
  init: Init = {},
  bindings: Partial<Env & PaymentSecrets> = {},
): Promise<Response> {
  return worker.fetch(new IncomingRequest(ORIGIN + path, init), { ...env, ...bindings });
}

export function post(body: unknown): Init {
  return { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

export function patch(body: unknown): Init {
  return { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}
