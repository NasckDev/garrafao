import { useEffect, useId } from "react";
import type { Award, AwardKey, AwardWinner, DraftInfo, SeasonAwards, SeasonEvents, SeasonLeaders } from "../../../server/types";
import { useAwards, useDraft, useLeaders, useSeasonEvents } from "../../api/hooks";
import { Headshot, TeamLogo } from "../../components/bits";
import { EmptyState, ErrorState, PartialNotice, Skeleton } from "../../components/states";
import { formatDate, formatGameWhen, formatNumber, gameDayKey, lastCompletedSeason, seasonLabel, seasonYearAt } from "../../lib/format";
import { buildHash, navigate, type Route } from "../../lib/router";

/** Temporadas no seletor: a corrente e as dez anteriores. */
const SEASONS_BACK = 10;
const MAIN_AWARDS: readonly AwardKey[] = ["mvp", "roy"];
const OTHER_AWARDS: readonly AwardKey[] = ["dpoy", "sixth", "mip", "clutch", "allstar-mvp"];

function Source({ children }: { children: string }) {
  return <p className="source-note">Fonte: {children}</p>;
}

const playerHash = (id: string) => buildHash("jogadores", id);

function Winner({ winner, size = 56 }: { winner: AwardWinner; size?: number }) {
  const { athlete, team } = winner;
  return (
    <div className="aw-person">
      <Headshot src={athlete.headshot} name={athlete.name} size={size} />
      <span className="aw-person-text">
        <a href={playerHash(athlete.id)}>{athlete.name}</a>
        <small>{[team?.name, athlete.position].filter(Boolean).join(" · ") || "Time não informado"}</small>
      </span>
    </div>
  );
}

function AwardBlock({ award }: { award: Award }) {
  return (
    <div className="aw-award">
      <p className="aw-label">{award.name}</p>
      {award.winners.map((winner) => (
        <Winner key={winner.athlete.id} winner={winner} />
      ))}
    </div>
  );
}

function ChampionCard({ data }: { data: SeasonAwards }) {
  const finalsMvp = data.awards.find((award) => award.key === "finals-mvp");
  const { finals } = data;
  return (
    <section className="ev-card aw-card" aria-labelledby="aw-champion">
      <h3 id="aw-champion">Campeão da NBA</h3>
      {finals ? (
        <div className="aw-champ">
          <TeamLogo team={finals.champion} size={64} />
          <div>
            <p className="aw-champ-name">{finals.champion.name}</p>
            <p className="muted">
              Venceu a final por {finals.wins} a {finals.losses} contra o {finals.runnerUp.name}; último jogo em {formatDate(finals.decidedAt)}.
            </p>
          </div>
        </div>
      ) : data.failed.includes("finals") ? (
        <p className="muted">O calendário dos playoffs não carregou agora. Tente de novo em instantes.</p>
      ) : (
        <p className="muted">A fonte ainda não tem uma final encerrada nesta temporada.</p>
      )}
      {finalsMvp ? <AwardBlock award={finalsMvp} /> : null}
      <Source>calendário da ESPN, jogos com a nota oficial “NBA Finals”; MVP das Finais pela API core de prêmios.</Source>
    </section>
  );
}

function CupCard({ year, events, cupMvp }: { year: number; events: ReturnType<typeof useSeasonEvents>; cupMvp: Award | undefined }) {
  const data: SeasonEvents | undefined = events.data;
  const final = data?.cup.knockout.find((event) => event.stage === "final");
  const game = final?.game;
  const winner = game?.state === "post" ? (game.home.winner ? game.home : game.away.winner ? game.away : null) : null;
  const loser = winner ? (winner === game?.home ? game?.away : game?.home) : null;
  return (
    <section className="ev-card aw-card" aria-labelledby="aw-cup">
      <h3 id="aw-cup">Copa NBA</h3>
      {events.isPending ? (
        <Skeleton label="Procurando a final da Copa NBA…" rows={2} />
      ) : events.isError ? (
        <ErrorState error={events.error} onRetry={() => void events.refetch()} title="Não foi possível carregar a Copa NBA" />
      ) : winner && loser && game ? (
        <div className="aw-champ">
          <TeamLogo team={winner.team} size={64} />
          <div>
            <p className="aw-champ-name">{winner.team.name}</p>
            <p className="muted">
              Campeão da Copa NBA {seasonLabel(year)}: {winner.score ?? "–"} a {loser.score ?? "–"} no {loser.team.name}, em {formatDate(game.date)}.{" "}
              <a href={buildHash("ao-vivo", gameDayKey(game), { jogo: game.id })}>Ver a final</a>
            </p>
          </div>
        </div>
      ) : game ? (
        <p className="muted">Final da Copa NBA ainda não disputada: {formatGameWhen(game)}.</p>
      ) : (
        <p className="muted">
          {data?.months.failed.length
            ? "Parte do calendário não carregou, e a final da Copa NBA não apareceu nos meses lidos."
            : "A fonte não publica uma final da Copa NBA nesta temporada."}
        </p>
      )}
      {cupMvp ? <AwardBlock award={cupMvp} /> : null}
      <Source>calendário da ESPN, jogo com a nota oficial “NBA Cup Championship”; MVP da Copa pela API core de prêmios.</Source>
    </section>
  );
}

function DraftCard({ draft }: { draft: ReturnType<typeof useDraft> }) {
  const data: DraftInfo | undefined = draft.data;
  const top = (data?.picks ?? []).filter((pick) => pick.overall <= 3);
  return (
    <section className="ev-card aw-card" aria-labelledby="aw-draft">
      <h3 id="aw-draft">{data ? `Draft ${data.year}: as três primeiras escolhas` : "Draft: as três primeiras escolhas"}</h3>
      {draft.isPending ? (
        <Skeleton label="Carregando o Draft…" rows={3} />
      ) : draft.isError ? (
        <ErrorState error={draft.error} onRetry={() => void draft.refetch()} title="Não foi possível carregar o Draft" />
      ) : top.length ? (
        <ol className="aw-picks">
          {top.map((pick) => (
            <li key={pick.overall}>
              <span className="pk-n" aria-hidden="true">
                {pick.overall}
              </span>
              <Headshot src={pick.athlete?.headshot ?? null} name={pick.athlete?.name ?? "?"} size={48} />
              <span className="aw-person-text">
                <strong>
                  <span className="sr">Escolha {pick.overall}: </span>
                  {pick.athlete?.name ?? "Escolha sem atleta informado"}
                </strong>
                <small>{[pick.team?.name, pick.athlete?.position, pick.athlete?.from].filter(Boolean).join(" · ")}</small>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">As escolhas deste Draft ainda não foram publicadas pela fonte.</p>
      )}
      <Source>ESPN, página do Draft (escolhas).</Source>
    </section>
  );
}

function SeasonPrizes({ year, awards }: { year: number; awards: ReturnType<typeof useAwards> }) {
  const events = useSeasonEvents(year);
  const draft = useDraft(year);
  if (awards.isPending) return <Skeleton label="Carregando os prêmios da temporada…" rows={4} variant="cards" />;
  if (awards.isError) return <ErrorState error={awards.error} onRetry={() => void awards.refetch()} title="Não foi possível carregar os prêmios" />;
  const data = awards.data;
  const byKey = new Map(data.awards.map((award) => [award.key, award]));
  const main = MAIN_AWARDS.map((key) => byKey.get(key)).filter((award): award is Award => !!award);
  const others = OTHER_AWARDS.map((key) => byKey.get(key)).filter((award): award is Award => !!award);
  const nothing = data.awards.length === 0 && !data.finals && data.failed.length === 0;
  return (
    <>
      {data.failed.length ? (
        <PartialNotice>Parte dos prêmios não carregou agora ({data.failed.length}). O que aparece abaixo veio completo da fonte.</PartialNotice>
      ) : null}
      {nothing ? (
        <EmptyState title="Nenhum prêmio publicado ainda">
          A ESPN ainda não publicou campeão nem prêmios individuais da temporada {data.label}. Eles aparecem aqui quando a fonte os publica.
        </EmptyState>
      ) : null}
      <div className="ev-grid aw-grid">
        {nothing ? null : <ChampionCard data={data} />}
        <CupCard year={year} events={events} cupMvp={byKey.get("cup-mvp")} />
        {main.length ? (
          <section className="ev-card aw-card" aria-labelledby="aw-main">
            <h3 id="aw-main">MVP e calouro do ano</h3>
            {main.map((award) => (
              <AwardBlock key={award.key} award={award} />
            ))}
            <Source>ESPN, API core de prêmios da temporada.</Source>
          </section>
        ) : null}
        <DraftCard draft={draft} />
        {others.length ? (
          <section className="ev-card aw-card aw-wide" aria-labelledby="aw-others">
            <h3 id="aw-others">Outros prêmios</h3>
            <ul className="aw-others">
              {others.map((award) => (
                <li key={award.key}>
                  <AwardBlock award={award} />
                </li>
              ))}
            </ul>
            <Source>ESPN, API core de prêmios da temporada.</Source>
          </section>
        ) : null}
      </div>
    </>
  );
}

function MvpRace({ season, leaders }: { season: number; leaders: ReturnType<typeof useLeaders> }) {
  const data: SeasonLeaders | undefined = leaders.data;
  return (
    <section className="ev-card aw-race" aria-labelledby="aw-race">
      <h2 id="aw-race">
        Disputa pelo MVP · <span className="nowrap">{seasonLabel(season)}</span>
      </h2>
      <p className="muted">
        A ESPN não publica votação nem ranking do MVP nos dados abertos. Para acompanhar a disputa, estes são os líderes estatísticos da temporada em
        andamento (médias por jogo).
      </p>
      {leaders.isPending ? (
        <Skeleton label="Carregando os líderes da temporada…" rows={3} variant="cards" />
      ) : leaders.isError ? (
        <ErrorState error={leaders.error} onRetry={() => void leaders.refetch()} title="Não foi possível carregar os líderes" />
      ) : data && data.categories.length ? (
        <div className="aw-leaders">
          {data.categories.map((category) => (
            <section key={category.key} aria-label={category.name}>
              <h3>{category.name}</h3>
              <ol>
                {category.leaders.map((leader, index) => (
                  <li key={leader.athlete.id}>
                    <span className="aw-rank" aria-hidden="true">
                      {index + 1}
                    </span>
                    <Headshot src={leader.athlete.headshot} name={leader.athlete.name} size={40} />
                    <span className="aw-person-text">
                      <a href={playerHash(leader.athlete.id)}>
                        <span className="sr">{index + 1}º: </span>
                        {leader.athlete.name}
                      </a>
                      <small>{leader.team?.abbr ?? "Time não informado"}</small>
                    </span>
                    <b>{formatNumber(leader.value, 1)}</b>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState title="Ainda sem líderes">A temporada {seasonLabel(season)} ainda não tem estatísticas publicadas pela fonte.</EmptyState>
      )}
      <Source>ESPN, líderes da temporada regular.</Source>
    </section>
  );
}

/** Temporada pedida no link (`#/premios/2025`); fora do intervalo oferecido, vale a última encerrada. */
export function seasonFromRoute(param: string | null, now: Date): { year: number; valid: boolean } {
  const fallback = lastCompletedSeason(now);
  if (param === null) return { year: fallback, valid: true };
  const year = /^\d{4}$/.test(param) ? Number(param) : NaN;
  const current = seasonYearAt(now);
  return year <= current && year >= current - SEASONS_BACK ? { year, valid: true } : { year: fallback, valid: false };
}

export function AwardsPage({ route, now }: { route: Route; now: () => Date }) {
  const today = now();
  const current = seasonYearAt(today);
  const { year, valid } = seasonFromRoute(route.param, today);
  const selectId = useId();
  const leaders = useLeaders(current);
  const awards = useAwards(year);

  // Link com temporada inválida vira o endereço canônico, sem criar entrada no histórico.
  useEffect(() => {
    if (!valid) navigate(buildHash("premios"), true);
  }, [valid]);

  const seasons = Array.from({ length: SEASONS_BACK + 1 }, (_, index) => current - index);

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Prêmios</h1>
        <p className="page-sub">Campeões, prêmios individuais e Draft de cada temporada, só com o que a ESPN publica. Nada é estimado.</p>
      </div>

      <MvpRace season={current} leaders={leaders} />

      <div className="aw-bar">
        <h2 id="aw-season">Temporada {seasonLabel(year)}</h2>
        <div className="aw-select">
          <label htmlFor={selectId}>Ver temporada</label>
          <select id={selectId} value={year} onChange={(event) => navigate(buildHash("premios", event.target.value))}>
            {seasons.map((season) => (
              <option key={season} value={season}>
                {seasonLabel(season)}
                {season === current ? " (em andamento)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>
      <SeasonPrizes key={year} year={year} awards={awards} />
    </div>
  );
}
