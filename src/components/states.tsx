import type { ReactNode } from "react";
import { ApiError } from "../api/client";
import { formatDateTime } from "../lib/format";

export function Skeleton({ label = "Carregando…", rows = 3, variant = "rows" }: { label?: string; rows?: number; variant?: "rows" | "cards" }) {
  return (
    <div className={`skeleton skeleton-${variant}`} role="status" aria-live="polite">
      <span className="sr">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="sk-block" aria-hidden="true" />
      ))}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="state state-empty" role="status">
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
    </div>
  );
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === "offline") return "Sem conexão. Confira a internet e tente de novo.";
    if (error.kind === "unavailable") return "A fonte de dados não respondeu agora. Tente de novo em instantes.";
    if (error.kind === "not-found") return "Não encontramos esse dado na fonte.";
    return error.message;
  }
  return "Algo deu errado ao carregar.";
}

export function ErrorState({ error, onRetry, title = "Não foi possível carregar" }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <div className="state state-error" role="alert">
      <h3>{title}</h3>
      <p>{errorMessage(error)}</p>
      {onRetry ? (
        <button type="button" className="btn" onClick={onRetry}>
          Tentar de novo
        </button>
      ) : null}
    </div>
  );
}

/** Aviso de modo offline: deixa claro que é um instantâneo e de quando. */
export function SnapshotNotice({ capturedAt, onRetry, what }: { capturedAt: string; onRetry?: () => void; what: string }) {
  return (
    <div className="notice notice-offline" role="status">
      <span className="notice-dot" aria-hidden="true" />
      <p>
        <strong>Sem conexão com a fonte.</strong> Mostrando {what} do instantâneo gravado em {formatDateTime(capturedAt)} (horário de Brasília).
      </p>
      {onRetry ? (
        <button type="button" className="btn btn-small" onClick={onRetry}>
          Tentar de novo
        </button>
      ) : null}
    </div>
  );
}

export function PartialNotice({ children }: { children: ReactNode }) {
  return (
    <div className="notice notice-partial" role="status">
      <span className="notice-dot" aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}
