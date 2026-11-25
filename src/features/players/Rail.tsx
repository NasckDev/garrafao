import { useEffect, useRef } from "react";
import { swatch, teamPalette } from "../../lib/teams";
import { animate, EASE, prefersReducedMotion } from "../../lib/theme";
import type { PlayerView } from "./model";

export interface RemoteChip {
  id: string;
  name: string;
  detail: string;
}

export function Rail({ players, remote, selectedId, favorites, message, onSelect, staggerKey }: {
  players: PlayerView[];
  remote: RemoteChip[];
  selectedId: string | null;
  favorites: readonly string[];
  message: string | null;
  onSelect: (id: string, origin: HTMLElement) => void;
  staggerKey: string;
}) {
  const rail = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = rail.current;
    if (!node) return;
    [...node.children].slice(0, 14).forEach((chip, i) =>
      animate(chip, [{ opacity: 0, transform: "translateY(22px)" }, { opacity: 1, transform: "none" }], { duration: 520, delay: 120 + i * 45, easing: EASE, fill: "backwards" }),
    );
  }, [staggerKey]);

  useEffect(() => {
    const node = rail.current;
    const current = node?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!node || !current) return;
    const left = current.offsetLeft - node.offsetLeft - (node.clientWidth - current.offsetWidth) / 2;
    node.scrollTo?.({ left, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [selectedId]);

  return (
    <div className="rail" ref={rail}>
      {players.map((p) => {
        const palette = teamPalette(p.team, p.name);
        const fav = favorites.includes(p.id);
        return (
          <button
            key={p.id}
            className="chip"
            type="button"
            data-id={p.id}
            aria-current={p.id === selectedId}
            onClick={(event) => onSelect(p.id, event.currentTarget)}
          >
            <span className="sw" style={swatch(palette)} aria-hidden="true">
              {p.jersey ?? ""}
            </span>
            <strong>
              {p.name}
              {fav ? (
                <span className="chip-fav" title="Favorito">
                  <span aria-hidden="true">★</span>
                  <span className="sr">, favorito</span>
                </span>
              ) : null}
            </strong>
            <em>
              {palette.abbr}
              {p.posName ? `, ${p.posName.toLowerCase()}` : ""}
            </em>
          </button>
        );
      })}
      {remote.map((r) => (
        <button key={`r${r.id}`} className="chip chip-remote" type="button" data-id={r.id} onClick={(event) => onSelect(r.id, event.currentTarget)}>
          <span className="sw sw-plus" aria-hidden="true">
            +
          </span>
          <strong>{r.name}</strong>
          <em>{r.detail}</em>
        </button>
      ))}
      {players.length === 0 && remote.length === 0 && message ? (
        <p className="rail-msg" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
