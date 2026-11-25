import { useId, useMemo, useState } from "react";
import { usePlayers, useScoreboard, useStandings } from "../../api/hooks";
import { FavButton, TeamLogo } from "../../components/bits";
import { EmptyState, ErrorState, SnapshotNotice, Skeleton } from "../../components/states";
import { FEATURED_IDS } from "../../config/featured";
import { dayKey, formatNumber, formatWinPct, gameStatusText } from "../../lib/format";
import { buildHash } from "../../lib/router";
import { useFavorites } from "../../lib/storage";
import { swatch, teamPalette } from "../../lib/teams";
import { DuelTable } from "../players/Lab";
import { toView, type PlayerView } from "../players/model";

const FEATURED = new Set<string>(FEATURED_IDS);

function QuickCompare({ players }: { players: PlayerView[] }) {
  const [a, setA] = useState(players[0]?.id ?? "");
  const [b, setB] = useState(players[1]?.id ?? "");
  const idA = useId();
  const idB = useId();
  const pa = players.find((p) => p.id === a) ?? players[0];
  const pb = players.find((p) => p.id === b && p.id !== pa?.id) ?? players.find((p) => p.id !== pa?.id);
  if (!pa || !pb) return null;
  return (
    <section className="card fav-compare" aria-labelledby="fav-cmp">
      <h2 id="fav-cmp">Comparação rápida</h2>
      <div className="cmp-selects">
        <label htmlFor={idA}>Jogador</label>
        <select id={idA} value={pa.id} onChange={(e) => setA(e.target.value)}>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label htmlFor={idB}>Contra</label>
        <select id={idB} value={pb.id} onChange={(e) => setB(e.target.value)}>
          {players
            .filter((p) => p.id !== pa.id)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
      </div>
      <DuelTable a={pa} b={pb} />
    </section>
  );
}

function FavoriteTeams({ ids, onToggle }: { ids: readonly string[]; onToggle: (id: string) => void }) {
  const standings = useStandings();
  const today = dayKey(new Date());
  const board = useScoreboard(today);
  const rows = useMemo(() => {
    const all = standings.data?.data.conferences.flatMap((c) => c.teams.map((t) => ({ ...t, conf: c.name }))) ?? [];
    return ids.map((id) => all.find((t) => t.team.id === id)).filter((t): t is NonNullable<typeof t> => !!t);
  }, [standings.data, ids]);
  if (ids.length === 0) {
    return <EmptyState title="Você ainda não segue nenhum time">Use o botão “Seguir” na Classificação ou no detalhe de um jogo.</EmptyState>;
  }
  if (standings.isPending) return <Skeleton label="Carregando times favoritos…" rows={2} />;
  if (standings.isError) return <ErrorState error={standings.error} onRetry={() => void standings.refetch()} />;
  return (
    <ul className="fav-teams">
      {rows.map((row) => {
        const game = board.data?.games.find((g) => g.home.team.id === row.team.id || g.away.team.id === row.team.id);
        const opponent = game ? (game.home.team.id === row.team.id ? game.away.team : game.home.team) : null;
        return (
          <li key={row.team.id} className="card fav-team">
            <TeamLogo team={row.team} size={44} />
            <div>
              <strong>{row.team.name}</strong>
              <small>
                {row.seed ? `${row.seed}º na ${row.conf}` : row.conf}, {row.wins}-{row.losses} ({formatWinPct(row.pct)})
              </small>
              {game && opponent ? (
                <a href={buildHash("ao-vivo", null, { jogo: game.id })}>
                  Hoje: {game.home.team.id === row.team.id ? "contra" : "visita o"} {opponent.shortName}, {gameStatusText(game)}
                </a>
              ) : (
                <small>{board.data ? "Sem jogo hoje." : ""}</small>
              )}
            </div>
            <FavButton active name={row.team.name} kind="team" onToggle={() => onToggle(row.team.id)} compact />
          </li>
        );
      })}
    </ul>
  );
}

export function FavoritesPage() {
  const favorites = useFavorites();
  const players = usePlayers(favorites.players, { fallback: true });
  const views = useMemo(() => {
    const byId = new Map((players.data?.data.players ?? []).map((p) => [p.athlete.id, toView(p, FEATURED.has(p.athlete.id))]));
    return favorites.players.map((id) => byId.get(id)).filter((p): p is PlayerView => !!p);
  }, [players.data, favorites.players]);

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Favoritos</h1>
        <p className="page-sub">Guardados só neste navegador. Favoritos aparecem primeiro nas listas de jogadores e de jogos.</p>
      </div>
      <h2 className="sec-title">Jogadores</h2>
      {favorites.players.length === 0 ? (
        <EmptyState title="Nenhum jogador favorito">
          Use o botão “Favoritar” ao lado do nome de um jogador, na aba <a href={buildHash("jogadores")}>Jogadores</a>.
        </EmptyState>
      ) : players.isPending ? (
        <Skeleton label="Carregando favoritos…" rows={3} variant="cards" />
      ) : players.isError && !players.data ? (
        <ErrorState error={players.error} onRetry={() => void players.refetch()} />
      ) : (
        <>
          {players.data?.source === "snapshot" && players.data.capturedAt ? (
            <SnapshotNotice capturedAt={players.data.capturedAt} what="os favoritos que estão" onRetry={() => void players.refetch()} />
          ) : null}
          <ul className="fav-players">
            {views.map((p) => {
              const palette = teamPalette(p.team, p.name);
              return (
                <li key={p.id} className="card fav-player">
                  <span className="sw" style={swatch(palette)} aria-hidden="true">
                    {p.jersey ?? ""}
                  </span>
                  <div className="fp-main">
                    <a href={buildHash("jogadores", p.id)}>{p.name}</a>
                    <small>
                      {palette.name}
                      {p.posName ? `, ${p.posName.toLowerCase()}` : ""}
                    </small>
                    <dl className="fp-stats">
                      <div>
                        <dt>PTS</dt>
                        <dd>{formatNumber(p.stats.pts)}</dd>
                      </div>
                      <div>
                        <dt>REB</dt>
                        <dd>{formatNumber(p.stats.reb)}</dd>
                      </div>
                      <div>
                        <dt>AST</dt>
                        <dd>{formatNumber(p.stats.ast)}</dd>
                      </div>
                    </dl>
                  </div>
                  <FavButton active name={p.name} kind="player" onToggle={() => favorites.toggle("players", p.id)} compact />
                </li>
              );
            })}
          </ul>
          {(players.data?.data.missing.length ?? 0) > 0 ? (
            <p className="notice notice-partial" role="status">
              <span className="notice-dot" aria-hidden="true" />
              {players.data?.data.missing.length} favorito(s) não vieram da fonte agora.
            </p>
          ) : null}
          {views.length >= 2 ? <QuickCompare players={views} /> : <p className="muted">Marque dois jogadores para comparar lado a lado.</p>}
        </>
      )}
      <h2 className="sec-title">Times que você segue</h2>
      <FavoriteTeams ids={favorites.teams} onToggle={(id) => favorites.toggle("teams", id)} />
    </div>
  );
}
