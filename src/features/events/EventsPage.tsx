import { useState } from "react";
import type { DraftInfo, SeasonEvent } from "../../../server/types";
import { useDraft, useSeasonEvents } from "../../api/hooks";
import { TeamLogo } from "../../components/bits";
import { EmptyState, ErrorState, PartialNotice, Skeleton } from "../../components/states";
import { formatDate, formatDateTime, formatGameWhen, gameDayKey, seasonLabel, seasonYearAt } from "../../lib/format";
import { buildHash } from "../../lib/router";
import { StatusChip } from "../live/LivePage";

const STAGE: Record<SeasonEvent["stage"], string> = {
  group: "Fase de grupos",
  quarterfinal: "Quartas de final",
  semifinal: "Semifinal",
  final: "Final",
  allstar: "All-Star",
};

function Source({ children }: { children: string }) {
  return <p className="source-note">Fonte: {children}</p>;
}

function EventGame({ event }: { event: SeasonEvent }) {
  const { game } = event;
  const name = (side: "home" | "away") => (game[side].team.tbd ? "A definir" : game[side].team.name);
  return (
    <li className="ev-game">
      <div className="ev-when">
        <span className="ev-stage">{STAGE[event.stage]}</span>
        <span>{formatGameWhen(game)}</span>
      </div>
      <div className="ev-teams">
        <TeamLogo team={game.away.team} size={28} />
        <span>{name("away")}</span>
        {game.state !== "pre" ? <b>{game.away.score ?? "–"}</b> : null}
        <span className="ev-x" aria-hidden="true">
          x
        </span>
        {game.state !== "pre" ? <b>{game.home.score ?? "–"}</b> : null}
        <span>{name("home")}</span>
        <TeamLogo team={game.home.team} size={28} />
      </div>
      <div className="ev-actions">
        {game.state === "pre" ? <span /> : <StatusChip game={game} />}
        <a className="btn btn-ghost btn-small" href={buildHash("ao-vivo", gameDayKey(game), { jogo: game.id })}>
          Ver jogo<span className="sr">: {name("away")} x {name("home")}</span>
        </a>
      </div>
    </li>
  );
}

function DraftSection({ draft, previous }: { draft: DraftInfo | undefined; previous: DraftInfo | undefined }) {
  const withPicks = draft?.picks.length ? draft : previous?.picks.length ? previous : null;
  return (
    <section className="ev-card" aria-labelledby="ev-draft">
      <h2 id="ev-draft">Draft</h2>
      {draft ? (
        <dl className="ev-facts">
          <div>
            <dt>Draft {draft.year}</dt>
            <dd>{draft.start ? `${formatDateTime(draft.start)} (Brasília), data publicada pela fonte` : "Data ainda não publicada pela fonte"}</dd>
          </div>
          <div>
            <dt>Situação</dt>
            <dd>{draft.statusText ?? "Não informada"}</dd>
          </div>
          {draft.rounds ? (
            <div>
              <dt>Rodadas</dt>
              <dd>{draft.rounds}</dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <p className="muted">A fonte não publicou o Draft desta temporada.</p>
      )}
      {withPicks ? (
        <>
          <h3>Primeira rodada do Draft {withPicks.year}</h3>
          <ol className="picks">
            {withPicks.picks
              .filter((pick) => pick.round === 1)
              .map((pick) => (
                <li key={pick.overall}>
                  <span className="pk-n">{pick.overall}</span>
                  {pick.team ? <TeamLogo team={pick.team} size={26} /> : null}
                  <span className="pk-name">
                    <strong>{pick.athlete?.name ?? "Escolha sem atleta informado"}</strong>
                    <small>
                      {[pick.team?.shortName, pick.athlete?.position, pick.athlete?.from].filter(Boolean).join(", ")}
                      {pick.traded ? ", escolha negociada" : ""}
                    </small>
                  </span>
                </li>
              ))}
          </ol>
        </>
      ) : null}
      <Source>ESPN, API core (datas, rodadas e situação) e página do Draft (escolhas).</Source>
    </section>
  );
}

export function EventsPage({ now }: { now: () => Date }) {
  const current = seasonYearAt(now());
  const [season, setSeason] = useState(current);
  const events = useSeasonEvents(season);
  const draft = useDraft(season);
  const previousDraft = useDraft(season - 1);
  const data = events.data;

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Eventos</h1>
        <p className="page-sub">Calendário da temporada, Copa NBA, All-Star e Draft, só com o que as fontes públicas da ESPN publicam. Nenhuma data é estimada.</p>
      </div>
      <div className="seg" role="group" aria-label="Temporada">
        {[current, current - 1].map((year) => (
          <button key={year} type="button" aria-pressed={season === year} onClick={() => setSeason(year)}>
            Temporada {seasonLabel(year)}
          </button>
        ))}
      </div>

      {events.isPending ? (
        <Skeleton label="Lendo o calendário da temporada…" rows={5} variant="cards" />
      ) : events.isError ? (
        <ErrorState error={events.error} onRetry={() => void events.refetch()} title="Não foi possível carregar os eventos" />
      ) : data ? (
        <>
          {data.months.failed.length ? (
            <PartialNotice>
              Parte do calendário não carregou ({data.months.failed.length} de {data.months.failed.length + data.months.scanned.length} meses). Os eventos abaixo podem estar
              incompletos.
            </PartialNotice>
          ) : null}
          <div className="ev-grid">
            <section className="ev-card" aria-labelledby="ev-season">
              <h2 id="ev-season">Temporada {data.season.label}</h2>
              <ol className="phases">
                {data.season.phases.map((phase) => {
                  const nowIso = now().toISOString();
                  const active = phase.start && phase.end && phase.start <= nowIso && nowIso < phase.end;
                  return (
                    <li key={phase.id} className={active ? "phase-now" : ""}>
                      <strong>{phase.name}</strong>
                      <span>
                        {phase.start ? formatDate(phase.start) : "sem data"} a {phase.end ? formatDate(phase.end) : "sem data"}
                      </span>
                      {active ? <em>Em andamento</em> : null}
                    </li>
                  );
                })}
              </ol>
              <Source>ESPN, API core (tipos da temporada).</Source>
            </section>

            <section className="ev-card" aria-labelledby="ev-cup">
              <h2 id="ev-cup">Copa NBA</h2>
              {data.cup.group ? (
                <p>
                  Fase de grupos: {data.cup.group.count} jogos marcados como Copa NBA, de {formatDate(data.cup.group.first)} a {formatDate(data.cup.group.last)}.
                </p>
              ) : (
                <p className="muted">A fonte não marcou jogos de fase de grupos nesta temporada.</p>
              )}
              {data.cup.rounds ? <p>Mata-mata em {data.cup.rounds} rodadas, segundo a fonte.</p> : null}
              {data.cup.knockout.length ? (
                <ul className="ev-games">
                  {data.cup.knockout.map((event) => (
                    <EventGame key={event.game.id} event={event} />
                  ))}
                </ul>
              ) : (
                <EmptyState title="Mata-mata ainda não publicado">Os jogos de quartas, semifinal e final aparecem aqui quando a fonte os publica.</EmptyState>
              )}
              <Source>calendário da ESPN, jogos com a nota oficial “NBA Cup” (Copa NBA); rodadas pela API core.</Source>
            </section>

            <section className="ev-card" aria-labelledby="ev-allstar">
              <h2 id="ev-allstar">All-Star</h2>
              {data.allStar.length ? (
                <ul className="ev-games">
                  {data.allStar.map((event) => (
                    <EventGame key={event.game.id} event={event} />
                  ))}
                </ul>
              ) : (
                <EmptyState title="Data não disponível na fonte">
                  O calendário público da ESPN desta temporada ainda não tem jogos do All-Star. Não mostramos data estimada.
                </EmptyState>
              )}
              <Source>calendário da ESPN, jogos do tipo All-Star.</Source>
            </section>

            {draft.isPending ? (
              <Skeleton label="Carregando o Draft…" rows={3} />
            ) : draft.isError && previousDraft.isError ? (
              <section className="ev-card" aria-labelledby="ev-draft-err">
                <h2 id="ev-draft-err">Draft</h2>
                <ErrorState error={draft.error} onRetry={() => void draft.refetch()} />
              </section>
            ) : (
              <DraftSection draft={draft.data} previous={previousDraft.data} />
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
