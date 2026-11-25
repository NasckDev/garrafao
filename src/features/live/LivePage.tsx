import { useMemo } from "react";
import type { Game } from "../../../server/types";
import { useScoreboard } from "../../api/hooks";
import { TeamLogo } from "../../components/bits";
import { EmptyState, ErrorState, Skeleton } from "../../components/states";
import { ageText, dayKey, formatDayLong, gameLabel, gameStatusText, isDayKey, periodShort, shiftDay } from "../../lib/format";
import { usePageVisible, useSecondsSince } from "../../lib/polling";
import { buildHash, navigate, type Route } from "../../lib/router";
import { useFavorites } from "../../lib/storage";
import { GamePanel } from "./GamePanel";

/** Tipo do jogo em pt-BR (nota oficial traduzida ou fase da temporada). */
export function GameTag({ game }: { game: Game }) {
  const label = gameLabel(game);
  return (
    <span className="game-kind" lang={label.lang}>
      {label.text}
    </span>
  );
}

/** Placar por período: tabela pequena e acessível (cabeçalho de coluna e de linha). */
export function LineScore({ game }: { game: Game }) {
  const periods = Math.max(game.home.linescores.length, game.away.linescores.length);
  if (periods === 0) return null;
  return (
    <div className="linescore-scroll">
      <table className="linescore">
        <caption className="sr">
          Pontos por período: {game.away.team.name} contra {game.home.team.name}
        </caption>
        <thead>
          <tr>
            <th scope="col">
              <span className="sr">Time</span>
            </th>
            {Array.from({ length: periods }, (_, i) => (
              <th scope="col" key={i}>
                {periodShort(i)}
              </th>
            ))}
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {[game.away, game.home].map((c) => (
            <tr key={c.homeAway}>
              <th scope="row">{c.team.tbd ? "A definir" : c.team.abbr}</th>
              {Array.from({ length: periods }, (_, i) => (
                <td key={i}>{c.linescores[i] ?? "–"}</td>
              ))}
              <td className="total">{c.score ?? "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatusChip({ game }: { game: Game }) {
  return (
    <span className="status" data-state={game.state}>
      <i aria-hidden="true" />
      {game.state === "in" ? <span className="status-live">Ao vivo</span> : null}
      <span>{gameStatusText(game)}</span>
    </span>
  );
}

function GameCard({ game, followed, onOpen }: { game: Game; followed: boolean; onOpen: () => void }) {
  const showScore = game.state !== "pre";
  const name = (side: "home" | "away") => (game[side].team.tbd ? "A definir" : game[side].team.name);
  return (
    <li className={`game card${followed ? " game-fav" : ""}`} data-state={game.state}>
      <div className="game-top">
        <StatusChip game={game} />
        <GameTag game={game} />
        {followed ? <span className="tag tag-follow">Você segue</span> : null}
      </div>
      <ul className="game-teams">
        {[game.away, game.home].map((c) => (
          <li key={c.homeAway} className={game.state === "post" && c.winner ? "won" : ""}>
            <TeamLogo team={c.team} size={36} />
            <span className="gt-name">
              <strong>{c.team.tbd ? "A definir" : c.team.shortName}</strong>
              <small>
                {c.homeAway === "home" ? "Mandante" : "Visitante"}
                {c.record ? `, ${c.record}` : ""}
              </small>
            </span>
            <b className="gt-score">
              {showScore ? (c.score ?? "–") : ""}
              {game.state === "post" && c.winner ? <span className="sr"> (vencedor)</span> : null}
            </b>
          </li>
        ))}
      </ul>
      <LineScore game={game} />
      <button type="button" className="btn btn-ghost game-open" onClick={onOpen} aria-label={`Detalhes do jogo: ${name("away")} contra ${name("home")}`}>
        Detalhes do jogo
      </button>
    </li>
  );
}

/** Faixa de dias no padrão do seletor do protótipo: dia a dia, sem pular datas. */
function DayStrip({ date, today, onGo }: { date: string; today: string; onGo: (key: string) => void }) {
  const days = [-2, -1, 0, 1, 2].map((offset) => shiftDay(date, offset));
  const label = (key: string) => {
    const d = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(4, 6)) - 1, Number(key.slice(6, 8)), 12));
    const weekday = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short" }).format(d).replace(".", "");
    return { weekday, day: `${key.slice(6, 8)}/${key.slice(4, 6)}` };
  };
  return (
    <div className="daynav">
      <button type="button" className="btn btn-ghost day-step" onClick={() => onGo(shiftDay(date, -1))} aria-label="Dia anterior">
        <span aria-hidden="true">←</span>
        <span className="day-step-text" aria-hidden="true">
          Dia anterior
        </span>
      </button>
      <div className="seg daystrip" role="group" aria-label="Escolher o dia">
        {days.map((key) => {
          const { weekday, day } = label(key);
          return (
            <button key={key} type="button" className={key === shiftDay(date, -2) || key === shiftDay(date, 2) ? "day-far" : undefined} aria-pressed={key === date} onClick={() => onGo(key)} aria-label={`${formatDayLong(key)}${key === today ? " (hoje)" : ""}`}>
              <small>{key === today ? "hoje" : weekday}</small>
              <b>{day}</b>
            </button>
          );
        })}
      </div>
      <button type="button" className="btn btn-ghost day-step" onClick={() => onGo(shiftDay(date, 1))} aria-label="Próximo dia">
        <span className="day-step-text" aria-hidden="true">
          Próximo dia
        </span>
        <span aria-hidden="true">→</span>
      </button>
      {date !== today ? (
        <button type="button" className="btn" onClick={() => onGo(today)}>
          Voltar para hoje
        </button>
      ) : null}
    </div>
  );
}

export function LivePage({ route, now }: { route: Route; now: () => Date }) {
  const today = dayKey(now());
  const date = isDayKey(route.param ?? undefined) ? (route.param as string) : today;
  const gameId = route.query.get("jogo");
  const favorites = useFavorites();
  const board = useScoreboard(date);
  const visible = usePageVisible();
  const seconds = useSecondsSince(board.dataUpdatedAt || undefined);

  const isFollowed = (g: Game) => favorites.teams.includes(g.home.team.id) || favorites.teams.includes(g.away.team.id);
  const games = useMemo(() => {
    const list = board.data?.date === date ? board.data.games : [];
    const followed = (g: Game) => favorites.teams.includes(g.home.team.id) || favorites.teams.includes(g.away.team.id);
    const order = { in: 0, pre: 1, post: 2 } as const;
    return [...list].sort((a, b) => Number(followed(b)) - Number(followed(a)) || order[a.state] - order[b.state] || a.date.localeCompare(b.date));
  }, [board.data, date, favorites.teams]);

  const go = (key: string) => navigate(buildHash("ao-vivo", key === today ? null : key));
  const open = (id: string | null) => navigate(buildHash("ao-vivo", date === today ? null : date, { jogo: id }));
  const stale = board.isPlaceholderData || board.data?.date !== date;

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Ao vivo</h1>
        <p className="page-sub">Placares da rodada, com horários em Brasília. Jogos dos times que você segue aparecem primeiro.</p>
      </div>
      <DayStrip date={date} today={today} onGo={go} />
      <div className="board-meta">
        <h2 className="board-day">{formatDayLong(date)}</h2>
        {board.data && !stale ? (
          <p className="updated">
            {board.data.hasLive ? (
              <>
                <span className="pulse" aria-hidden="true" />
                {visible ? "Atualizando a cada 15 s" : "Atualização pausada com a aba em segundo plano"} ·{" "}
              </>
            ) : null}
            Atualizado {ageText(seconds ?? 0)}
          </p>
        ) : null}
      </div>

      {board.isError && !board.data ? (
        <ErrorState error={board.error} onRetry={() => void board.refetch()} title="Não foi possível carregar os placares" />
      ) : board.isPending || stale ? (
        <Skeleton label="Carregando placares…" rows={4} variant="cards" />
      ) : games.length === 0 ? (
        <EmptyState title="Nenhum jogo neste dia">A fonte não tem jogos da NBA marcados para {formatDayLong(date)}. Use as setas para ver outro dia.</EmptyState>
      ) : (
        <>
          {board.isError ? (
            <p className="notice notice-partial" role="status">
              <span className="notice-dot" aria-hidden="true" />A última atualização falhou; mostrando os placares anteriores.
            </p>
          ) : null}
          <ul className="games" aria-label={`Jogos de ${formatDayLong(date)}`}>
            {games.map((game) => (
              <GameCard key={game.id} game={game} followed={isFollowed(game)} onOpen={() => open(game.id)} />
            ))}
          </ul>
        </>
      )}
      {gameId && /^\d+$/.test(gameId) ? <GamePanel eventId={gameId} onClose={() => open(null)} hint={board.data?.games.find((g) => g.id === gameId)} /> : null}
    </div>
  );
}
