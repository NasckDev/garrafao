/** Cliente do proxy próprio (`/api/nba`). O navegador nunca fala direto com a ESPN. */

export const API_BASE: string = import.meta.env.VITE_API_BASE ?? "/api/nba";
const CLIENT_TIMEOUT_MS = 12_000;

export type ApiErrorKind = "offline" | "unavailable" | "not-found" | "invalid";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;

  constructor(kind: ApiErrorKind, message: string, status: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

export function apiUrl(op: string, params: Record<string, string | number> = {}): string {
  const search = new URLSearchParams({ op });
  for (const [key, value] of Object.entries(params)) search.set(key, String(value));
  return `${API_BASE}?${search.toString()}`;
}

export async function apiGet<T>(op: string, params: Record<string, string | number> = {}, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort);
  const timer = window.setTimeout(abort, CLIENT_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(apiUrl(op, params), { signal: controller.signal, headers: { Accept: "application/json" } });
  } catch {
    throw new ApiError("offline", "Sem conexão com a API do Garrafão.");
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
  // Servido como estático (sem a Function), /api/nba devolve a página HTML ou 404: tratamos como API ausente.
  const isJson = (response.headers.get("content-type") ?? "").includes("application/json");
  if (!isJson) throw new ApiError("unavailable", "A API do Garrafão não está disponível neste endereço.", response.status);
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const message = typeof body === "object" && body !== null && "error" in body && typeof body.error === "string" ? body.error : "Falha ao carregar.";
    const kind: ApiErrorKind = response.status === 404 ? "not-found" : response.status === 400 ? "invalid" : "unavailable";
    throw new ApiError(kind, message, response.status);
  }
  return body as T;
}

/** Erros que valem nova tentativa automática: rede e origem fora. 400/404 não mudam tentando de novo. */
export const isRetryable = (error: unknown) => !(error instanceof ApiError) || error.kind === "offline" || error.kind === "unavailable";

/** Falhas que justificam cair para o instantâneo offline. */
export const isOutage = (error: unknown) => error instanceof ApiError && (error.kind === "offline" || error.kind === "unavailable");
