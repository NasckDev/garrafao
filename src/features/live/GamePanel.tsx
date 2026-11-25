import { useEffect, useId, useRef } from "react";
import type { Game } from "../../../server/types";
import { useGameDetail } from "../../api/hooks";
import { FavButton, TeamLogo } from "../../components/bits";
import { ErrorState, Skeleton } from "../../components/states";
import { formatGameWhen, formatNumber } from "../../lib/format";
import { animate, EASE } from "../../lib/theme";
import { GameTag, LineScore, StatusChip } from "./LivePage";
import { useFavorites } from "../../lib/storage";

const CATEGORY: Record<string, string> = {
  points: "Pontos",
  rebounds: "Rebotes",
  assists: "Assistências",
  pointsPerGame: "Pontos por jogo",
  reboundsPerGame: "Rebotes por jogo",
  assistsPerGame: "Assistências por jogo",
};

/** Painel lateral modal com o detalhe do jogo. Esc fecha, o foco fica preso nele e volta ao botão de origem. */
export function GamePanel({ eventId, onClose, hint }: { eventId: string; onClose: () => void; hint?: Game }) {
  const detail = useGameDetail(eventId);
  const favorites = useFavorites();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = panel.current;
    node?.focus();
    animate(node, [{ transform: "translateX(24px)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 280, easing: EASE });
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        closeRef.current();
        return;
      }
      if (ev.key !== "Tab" || !node) return;
      const focusable = [...node.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]')];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (ev.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        ev.preventDefault();
        last.focus();
      } else if (!ev.shiftKey && document.activeElement === last) {
        ev.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("no-scroll");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("no-scroll");
      previous?.focus?.();
    };
  }, []);

  const data = detail.data;
  const game = data?.game;
  return (
    <div className="sheet-layer">
      <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={panel}>
        <div className="sheet-head">
          <h2 id={titleId}>{game ? `${game.away.team.tbd ? "A definir" : game.away.team.shortName} x ${game.home.team.tbd ? "A definir" : game.home.team.shortName}` : "Detalhe do jogo"}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar detalhe do jogo">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        {detail.isPending ? (
          <Skeleton label="Carregando o jogo…" rows={3} />
        ) : detail.isError || !data || !game ? (
          <ErrorState error={detail.error} onRetry={() => void detail.refetch()} title="Não foi possível carregar o jogo" />
        ) : (
          <div className="sheet-body">
            <div className="sheet-status">
              <StatusChip game={game} />
              <GameTag game={game.note || !hint ? game : { ...game, note: hint.note, kind: hint.kind }} />
            </div>
            <div className="sheet-score">
              {[game.away, game.home].map((c) => (
                <div key={c.homeAway} className={game.state === "post" && c.winner ? "won" : ""}>
                  <TeamLogo team={c.team} size={56} />
                  <span>{c.team.tbd ? "A definir" : c.team.name}</span>
                  <b>{game.state === "pre" ? "–" : (c.score ?? "–")}</b>
                  {!c.team.tbd ? (
                    <FavButton active={favorites.teams.includes(c.team.id)} name={c.team.name} kind="team" onToggle={() => favorites.toggle("teams", c.team.id)} compact />
                  ) : null}
                </div>
              ))}
            </div>
            <dl className="sheet-facts">
              <div>
                <dt>Quando</dt>
                <dd>{formatGameWhen(game)} (Brasília)</dd>
              </div>
              {game.venue ? (
                <div>
                  <dt>Local</dt>
                  <dd>{game.venue}</dd>
                </div>
              ) : null}
              {data.attendance ? (
                <div>
                  <dt>Público</dt>
                  <dd>{formatNumber(data.attendance, 0)}</dd>
                </div>
              ) : null}
            </dl>
            <h3>Placar por período</h3>
            {game.home.linescores.length ? <LineScore game={game} /> : <p className="muted">O jogo ainda não começou.</p>}
            <h3>{game.state === "pre" ? "Destaques da temporada" : "Destaques do jogo"}</h3>
            {data.leaders.length === 0 ? (
              <p className="muted">A fonte não publicou destaques para este jogo.</p>
            ) : (
              <div className="leaders-grid">
                {data.leaders.map((team) => (
                  <section key={team.teamId} aria-label={`Destaques de ${team.teamAbbr}`}>
                    <h4>{team.teamAbbr}</h4>
                    <ul>
                      {team.leaders.map((leader) => (
                        <li key={leader.category}>
                          <span className="ld-cat">{CATEGORY[leader.category] ?? leader.category}</span>
                          {leader.athleteId ? <a href={`#/jogadores/${leader.athleteId}`}>{leader.name}</a> : <span>{leader.name}</span>}
                          <b>{leader.value.replace(".", ",")}</b>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
