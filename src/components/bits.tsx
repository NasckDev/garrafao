import { useState } from "react";
import type { TeamRef } from "../../server/types";

export function Ball({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <circle cx="50" cy="50" r="46" fill="var(--accent)" />
      <path
        d="M50 4V96M4 50H96M18 16C36 34 36 66 18 84M82 16C64 34 64 66 82 84"
        fill="none"
        stroke="var(--accent-ink)"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Favoritar jogador ou seguir time: botão com rótulo visível (não é avaliação) e estado à vista.
 * O texto muda com o estado ("Favoritar" / "Favorito", "Seguir" / "Seguindo"); o nome acessível começa pelo texto visível e inclui o nome.
 */
export function FavButton({ active, name, kind, onToggle, compact = false }: {
  active: boolean;
  name: string;
  kind: "player" | "team";
  onToggle: () => void;
  compact?: boolean;
}) {
  const text = kind === "player" ? (active ? "Favorito" : "Favoritar") : active ? "Seguindo" : "Seguir";
  const hint = kind === "player" ? (active ? "Tirar dos favoritos" : "Guardar nos favoritos") : active ? "Deixar de seguir o time" : "Seguir o time: os jogos dele aparecem primeiro e destacados";
  return (
    <button
      type="button"
      className={`fav-btn${active ? " is-on" : ""}${compact ? " fav-compact" : ""}`}
      title={hint}
      aria-label={`${text} ${name}`}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" />
      </svg>
      <span>{text}</span>
    </button>
  );
}

/** Logo do time; se a imagem falhar, mostra a sigla (o nome completo fica no texto ao lado). */
export function TeamLogo({ team, size = 32 }: { team: TeamRef; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!team.logo || failed || team.tbd) {
    return (
      <span className="logo-fallback" style={{ width: size, height: size }} aria-hidden="true">
        {team.tbd ? "?" : team.abbr.slice(0, 3)}
      </span>
    );
  }
  return (
    <img
      className="team-logo"
      src={team.logo}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

/** Foto do atleta publicada pela ESPN; sem foto ou se ela falhar, mostra as iniciais (o nome fica no texto ao lado). */
export function Headshot({ src, name, size = 56 }: { src: string | null; name: string; size?: number }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) {
    return (
      <span className="headshot headshot-fallback" style={{ width: size, height: size }} aria-hidden="true">
        {initials(name)}
      </span>
    );
  }
  return <img className="headshot" src={src} alt="" width={size} height={size} decoding="async" onError={() => setFailedSrc(src)} />;
}
