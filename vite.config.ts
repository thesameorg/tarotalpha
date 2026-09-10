import { cloudflare } from "@cloudflare/vite-plugin";
import path from "node:path";
import { defineConfig } from "vite";

// Vite root is the client folder; wrangler.jsonc, the Worker and migrations stay at the repo root.
// Local D1/KV state is pinned to the repo root so `vite dev` and `wrangler ... --local` see the same data.
// The client builds two pages, the terminal and the English method page /how.html; the input is scoped to the
// client environment because the Cloudflare plugin would otherwise feed the HTML entries to the Worker build too.
export default defineConfig({
  root: "web",
  environments: {
    client: {
      build: {
        rollupOptions: {
          input: {
            main: path.resolve(import.meta.dirname, "web/index.html"),
            how: path.resolve(import.meta.dirname, "web/how.html"),
          },
        },
      },
    },
  },
  plugins: [cloudflare({ configPath: "../wrangler.jsonc", persistState: { path: "../.wrangler/state" } })],
});
