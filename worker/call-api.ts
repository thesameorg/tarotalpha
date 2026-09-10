/** Test helper: one Worker call with a real execution context, `waitUntil` work settled before assertions. */
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import worker from "./index";

const ORIGIN = "https://tarotalpha.test";
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
type Init = RequestInit<IncomingRequestCfProperties>;

export async function callApi(path: string, init: Init = {}, bindings: Partial<Env> = {}): Promise<Response> {
  const ctx = createExecutionContext();
  const response = await worker.fetch(new IncomingRequest(ORIGIN + path, init), { ...env, ...bindings }, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

export function post(body: unknown): Init {
  return { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}
