import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

// Vite root is the client folder; wrangler.jsonc, the Worker and migrations stay at the repo root.
// Local D1/KV state is pinned to the repo root so `vite dev` and `wrangler ... --local` see the same data.
export default defineConfig({
  root: "web",
  plugins: [cloudflare({ configPath: "../wrangler.jsonc", persistState: { path: "../.wrangler/state" } })],
});
