import type { ConferenceStandings } from "../../../server/types";
import { useStandings } from "../../api/hooks";
import { FavButton, TeamLogo } from "../../components/bits";
import { ErrorState, SnapshotNotice, Skeleton } from "../../components/states";
import { formatNumber, formatWinPct } from "../../lib/format";
import { useFavorites } from "../../lib/storage";

function streakText(streak: string | null): string {
  const match = /^([WL])(\d+)$/.exec(streak ?? "");
  if (!match) return streak ?? "–";
  return `${match[1] === "W" ? "V" : "D"}${match[2]}`;
}

function streakLabel(streak: string | null): string {
  const match = /^([WL])(\d+)$/.exec(streak ?? "");
  if (!match) return "";
  const n = Number(match[2]);
  return `${n} ${match[1] === "W" ? (n === 1 ? "vitória" : "vitórias") : n === 1 ? "derrota" : "derrotas"} seguida${n === 1 ? "" : "s"}`;
}

function ConferenceTable({ conference, favorites, onToggle }: { conference: ConferenceStandings; favorites: readonly string[]; onToggle: (id: string) => void }) {
  const titleId = `conf-${conference.id}`;
  return (
    <section className="conf" aria-labelledby={titleId}>
      <h2 id={titleId}>{conference.name}</h2>
      {/* A tabela rola dentro da própria caixa no celular; a caixa recebe foco para rolar pelo teclado. */}
      <div className="table-scroll" role="region" aria-label={`Tabela da ${conference.name}`} tabIndex={0}>
        <table className="standings">
          <caption className="sr">Classificação da {conference.name}. V vitórias, D derrotas, JA jogos atrás do líder.</caption>
          <thead>
            <tr>
              <th scope="col">
                <abbr title="Posição">#</abbr>
              </th>
              <th scope="col" className="col-team">
                Time
              </th>
              <th scope="col">
                <abbr title="Vitórias">V</abbr>
              </th>
              <th scope="col">
                <abbr title="Derrotas">D</abbr>
              </th>
              <th scope="col">
                <abbr title="Aproveitamento">%</abbr>
              </th>
              <th scope="col">
                <abbr title="Jogos atrás do líder">JA</abbr>
              </th>
              <th scope="col">
                <abbr title="Sequência atual">Seq.</abbr>
              </th>
              <th scope="col">
                <abbr title="Últimos 10 jogos">Últ. 10</abbr>
              </th>
              <th scope="col">Casa</th>
              <th scope="col">Fora</th>
              <th scope="col">
                <abbr title="Saldo de pontos">Saldo</abbr>
              </th>
              <th scope="col">
                <span className="sr">Seguir time</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {conference.teams.map((row, index) => {
              const fav = favorites.includes(row.team.id);
              const seed = row.seed ?? index + 1;
              return (
                <tr key={row.team.id} className={`${fav ? "row-fav " : ""}${seed === 6 ? "cut-playoff" : seed === 10 ? "cut-playin" : ""}`}>
                  <td className="num">{seed}</td>
                  <th scope="row" className="col-team">
                    <span className="team-cell">
                                            <TeamLogo team={row.team} size={26} />
                      <span className="team-name">{row.team.name}</span>
                      <span className="team-abbr" aria-hidden="true">
                        {row.team.abbr}
                      </span>
                    </span>
                  </th>
                  <td className="num">{row.wins}</td>
                  <td className="num">{row.losses}</td>
                  <td className="num">{formatWinPct(row.pct)}</td>
                  <td className="num">{row.gamesBehind === 0 ? "—" : formatNumber(row.gamesBehind, row.gamesBehind !== null && row.gamesBehind % 1 ? 1 : 0)}</td>
                  <td className="num" data-streak={row.streak?.[0] ?? ""}>
                    <span aria-hidden="true">{streakText(row.streak)}</span>
                    <span className="sr">{streakLabel(row.streak) || "sem dado"}</span>
                  </td>
                  <td className="num">{row.lastTen ?? "–"}</td>
                  <td className="num">{row.home ?? "–"}</td>
                  <td className="num">{row.road ?? "–"}</td>
                  <td className="num">{row.pointDiff === null ? "–" : `${row.pointDiff > 0 ? "+" : ""}${row.pointDiff}`}</td>
                  <td className="col-follow">
                    <FavButton active={fav} name={row.team.name} kind="team" onToggle={() => onToggle(row.team.id)} compact />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function StandingsPage() {
  const standings = useStandings();
  const favorites = useFavorites();
  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Classificação</h1>
        <p className="page-sub">
          {standings.data?.data.season ? `Temporada ${standings.data.data.season}. ` : ""}Os 6 primeiros de cada conferência vão direto aos playoffs; do 7º ao 10º disputam o play-in.
        </p>
      </div>
      {standings.isPending ? (
        <Skeleton label="Carregando classificação…" rows={6} />
      ) : standings.isError ? (
        <ErrorState error={standings.error} onRetry={() => void standings.refetch()} title="Não foi possível carregar a classificação" />
      ) : (
        <>
          {standings.data.source === "snapshot" && standings.data.capturedAt ? (
            <SnapshotNotice capturedAt={standings.data.capturedAt} what="a classificação" onRetry={() => void standings.refetch()} />
          ) : null}
          <div className="confs">
            {standings.data.data.conferences.map((conference) => (
              <ConferenceTable key={conference.id} conference={conference} favorites={favorites.teams} onToggle={(id) => favorites.toggle("teams", id)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
