import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./support/msw";

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => {
  server.resetHandlers();
  if (typeof window === "undefined") return;
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
});
afterAll(() => server.close());

// jsdom não implementa matchMedia nem scrollTo; o app trata ausência de movimento como "reduzir movimento".
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: query.includes("reduce"),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
if (typeof window !== "undefined") {
  window.scrollTo = () => undefined;
  Element.prototype.scrollTo = function scrollTo() {};
}

// A máquina de CI/local pode estar lenta: espera assíncrona mais longa nas buscas da Testing Library.
configure({ asyncUtilTimeout: 10_000 });
