/** Test helper: one Worker call against the real handler with the test bindings. */
import { env } from "cloudflare:workers";
import worker from "./index";

const ORIGIN = "https://tarotalpha.test";
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
type Init = RequestInit<IncomingRequestCfProperties>;

export async function callApi(path: string, init: Init = {}, bindings: Partial<Env> = {}): Promise<Response> {
  return worker.fetch(new IncomingRequest(ORIGIN + path, init), { ...env, ...bindings });
}

export function post(body: unknown): Init {
  return { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}
