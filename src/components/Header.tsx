import { buildHash, TABS, type Tab } from "../lib/router";
import type { ThemeMode } from "../lib/storage";
import { useThemeMode } from "../lib/theme";
import { formatDateTime } from "../lib/format";
import { Ball } from "./bits";

export type SourceMode = "probing" | "live" | "snapshot" | "down";

const NEXT_MODE: Record<ThemeMode, ThemeMode> = { system: "light", light: "dark", dark: "system" };
const MODE_LABEL: Record<ThemeMode, string> = { system: "Tema automático", light: "Tema claro", dark: "Tema escuro" };

function ThemeIcon({ mode }: { mode: ThemeMode }) {
  if (mode === "light")
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
      </svg>
    );
  if (mode === "dark")
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5v17a8.5 8.5 0 0 0 0-17Z" fill="currentColor" />
    </svg>
  );
}

export function Header({ tab, source, capturedAt, onBrand, onRetrySource }: {
  tab: Tab;
  source: SourceMode;
  capturedAt: string | null;
  onBrand: () => void;
  onRetrySource: () => void;
}) {
  const { mode, setMode } = useThemeMode();
  const sourceText =
    source === "live"
      ? "Dados: ESPN"
      : source === "snapshot" && capturedAt
        ? `Dados: instantâneo de ${formatDateTime(capturedAt).slice(0, 5)}`
        : source === "down"
          ? "Dados: indisponíveis"
          : "Dados: conectando…";
  const sourceHint =
    source === "live"
      ? "Fonte de dados conectada: ESPN, pelo proxy do Garrafão."
      : source === "snapshot"
        ? "A fonte não respondeu: mostrando o instantâneo gravado. Clique para tentar de novo."
        : source === "down"
          ? "A fonte não respondeu. Clique para tentar de novo."
          : "Conectando à fonte de dados.";
  return (
    <header className="top">
      <button className="brand" type="button" onClick={onBrand} title="Rever a abertura">
        <Ball />
        Garrafão
      </button>
      <nav className="tabs" aria-label="Seções">
        <ul>
          {TABS.map((item) => (
            <li key={item.id}>
              <a href={buildHash(item.id)} aria-current={item.id === tab ? "page" : undefined}>
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="top-tools">
        <button
          className="source"
          type="button"
          data-mode={source}
          onClick={source === "live" || source === "probing" ? undefined : onRetrySource}
          title={sourceHint}
          aria-label={`Situação dos dados: ${sourceText}. ${sourceHint}`}
        >
          <i aria-hidden="true" />
          <span>{sourceText}</span>
        </button>
        <button className="icon-btn" type="button" onClick={() => setMode(NEXT_MODE[mode])} aria-label={`${MODE_LABEL[mode]}. Trocar tema`} title={MODE_LABEL[mode]}>
          <ThemeIcon mode={mode} />
        </button>
      </div>
    </header>
  );
}
