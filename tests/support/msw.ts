import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createNbaHandler } from "../../server/handler";
import { fixtureFetch, FIXTURE_NOW } from "./fixture-fetch";

/** Roda o handler real do proxy sobre as respostas gravadas da ESPN. */
const handler = createNbaHandler({ fetch: fixtureFetch, now: () => FIXTURE_NOW, log: () => undefined });

export async function proxyResponse(url: string) {
  let status = 200;
  const headers = new Headers();
  let body: unknown = null;
  const response = {
    setHeader: (name: string, value: string) => headers.set(name, value),
    status(code: number) {
      status = code;
      return response;
    },
    json(value: unknown) {
      body = value;
    },
  };
  await handler({ method: "GET", url }, response);
  return HttpResponse.json(body as never, { status, headers });
}

export const apiHandler = http.get("*/api/nba", ({ request }) => proxyResponse(new URL(request.url).pathname + new URL(request.url).search));

export const server = setupServer(apiHandler);
