/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";

/**
 * No desenvolvimento, /api/nba roda o MESMO handler da Vercel Function (server/handler.ts).
 * Com GARRAFAO_FIXTURES=1, a origem é trocada pelas respostas gravadas (sem rede).
 */
function nbaApi(): Plugin {
  return {
    name: "garrafao-nba-api",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/api/nba", (req: IncomingMessage, res: ServerResponse) => {
        void (async () => {
          const { createNbaHandler } = (await server.ssrLoadModule("/server/handler.ts")) as typeof import("./server/handler");
          let deps = {};
          if (process.env.GARRAFAO_FIXTURES === "1") {
            const fixtures = (await server.ssrLoadModule("/tests/support/fixture-fetch.ts")) as typeof import("./tests/support/fixture-fetch");
            deps = { fetch: fixtures.fixtureFetch, now: () => fixtures.FIXTURE_NOW };
          }
          const response = {
            setHeader: (name: string, value: string) => res.setHeader(name, value),
            status(code: number) {
              res.statusCode = code;
              return response;
            },
            json(body: unknown) {
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              res.end(req.method === "HEAD" ? undefined : JSON.stringify(body));
            },
          };
          await createNbaHandler(deps)({ method: req.method, url: req.url }, response);
        })().catch((error: unknown) => {
          server.config.logger.error(String(error));
          res.statusCode = 500;
          res.end();
        });
      });
    },
  };
}

export default defineConfig({
  base: process.env.GARRAFAO_BASE ?? "/",
  plugins: [react(), nbaApi()],
  build: {
    target: "es2022",
    sourcemap: false,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    restoreMocks: true,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    maxWorkers: 2,
    pool: "threads",
  },
});
