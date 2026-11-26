import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { TeamRef } from "../../../server/types";
import { useRoster, useSearch, useTeams, usePlayers } from "../../api/hooks";
import { ErrorState, SnapshotNotice, Skeleton } from "../../components/states";
import { FEATURED_IDS } from "../../config/featured";
import { buildHash, navigate, type Route } from "../../lib/router";
import { useFavorites } from "../../lib/storage";
import { canonicalAbbr } from "../../lib/teams";
import { Lab } from "./Lab";
import { favoritesFirst, toView, type PlayerView, type PosGroup, type StatKey } from "./model";
import { PlayerInfo } from "./PlayerInfo";
import { Rail, type RemoteChip } from "./Rail";
import { Stage } from "./Stage";

const POSITIONS: { id: "all" | PosGroup; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "G", label: "Armadores" },
  { id: "F", label: "Alas" },
  { id: "C", label: "Pivôs" },
];

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const FEATURED = new Set<string>(FEATURED_IDS);

function matchTeam(teams: TeamRef[] | undefined, q: string): TeamRef | null {
  if (!teams || q.length < 3) return null;
  const needle = fold(q);
  return (
    teams.find((t) => fold(t.abbr) === needle || canonicalAbbr(t.abbr).toLowerCase() === needle) ??
    teams.find((t) => fold(t.name).includes(needle) || fold(t.shortName).includes(needle)) ??
    null
  );
}

export function PlayersPage({ route, onTeam }: { route: Route; onTeam: (team: TeamRef | null) => void }) {
  const favorites = useFavorites();
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<"all" | PosGroup>("all");
  const [lead, setLead] = useState<StatKey>("pts");
  const origin = useRef(50);
  const stageBox = useRef<HTMLDivElement>(null);
  const routeId = route.param && /^\d+$/.test(route.param) ? route.param : null;
  const compareId = route.query.get("vs");

  const featured = usePlayers(FEATURED_IDS, { fallback: true });
  // Destaque que faltou no lote (falha parcial da fonte) também é buscado sozinho quando é pedido pelo link ou pelos favoritos.
  const missingFeatured = featured.data?.data.missing;
  const extraIds = useMemo(() => {
    const missing = new Set(missingFeatured ?? []);
    return [...new Set([...favorites.players, routeId, compareId].filter((id): id is string => !!id && /^\d+$/.test(id) && (!FEATURED.has(id) || missing.has(id))))].slice(0, 30);
  }, [favorites.players, routeId, compareId, missingFeatured]);
  const extra = usePlayers(extraIds, { fallback: true });

  const all = useMemo(() => {
    const map = new Map<string, PlayerView>();
    for (const profile of featured.data?.data.players ?? []) map.set(profile.athlete.id, toView(profile, true));
    for (const profile of extra.data?.data.players ?? []) if (!map.has(profile.athlete.id)) map.set(profile.athlete.id, toView(profile, false));
    return map;
  }, [featured.data, extra.data]);

  const pool = useMemo(() => [...all.values()].filter((p) => p.featured), [all]);
  const ordered = useMemo(() => favoritesFirst([...all.values()].filter((p) => p.featured || favorites.players.includes(p.id) || p.id === routeId), favorites.players), [all, favorites.players, routeId]);
  const fallbackId = ordered[0]?.id ?? null;
  const selected = (routeId ? all.get(routeId) : undefined) ?? (routeId && extra.isFetching ? undefined : fallbackId ? all.get(fallbackId) : undefined);
  const rival = compareId && compareId !== selected?.id ? all.get(compareId) ?? null : null;

  // Busca: a liga inteira (search) e, se o termo for um time, o elenco dele (teams + roster).
  const deferred = useDeferredValue(query.trim());
  const search = useSearch(deferred);
  const teams = useTeams();
  const team = matchTeam(teams.data, deferred);
  const roster = useRoster(team?.id ?? null);

  const visible = useMemo(() => {
    const q = fold(deferred);
    return ordered.filter((p) => {
      if (pos !== "all" && p.posGroup !== pos) return false;
      if (!q) return true;
      const t = p.team;
      return fold(`${p.name} ${t?.name ?? ""} ${t?.abbr ?? ""}`).includes(q) || (team !== null && t?.id === team.id);
    });
  }, [ordered, deferred, pos, team]);

  const remote: RemoteChip[] = useMemo(() => {
    if (deferred.length < 3) return [];
    const known = new Set(visible.map((p) => p.id));
    const chips: RemoteChip[] = [];
    for (const player of roster.data?.players ?? []) {
      if (known.has(player.id) || (pos !== "all" && !player.position?.toUpperCase().includes(pos))) continue;
      known.add(player.id);
      chips.push({ id: player.id, name: player.name, detail: `${roster.data?.team.abbr ?? ""}${player.jersey ? `, camisa ${player.jersey}` : ""}` });
    }
    for (const hit of search.data ?? []) {
      if (known.has(hit.id)) continue;
      known.add(hit.id);
      chips.push({ id: hit.id, name: hit.name, detail: `Carregar da liga${hit.teamAbbr ? `, ${hit.teamAbbr}` : ""}` });
    }
    return chips;
  }, [deferred, roster.data, search.data, visible, pos]);

  const searching = deferred.length >= 3 && (search.isFetching || roster.isFetching);
  const railMessage = searching
    ? "Buscando na liga…"
    : search.isError
      ? "A busca na liga não respondeu agora. A lista mostra só os jogadores já carregados."
      : deferred.length > 0 && deferred.length < 3
        ? "Digite ao menos 3 letras para buscar na liga inteira."
        : "Nenhum jogador da NBA com esse nome. Confira a grafia ou busque pelo sobrenome.";

  const selectedTeam = selected?.team ?? null;
  useEffect(() => {
    if (selected) onTeam(selectedTeam);
  }, [selected, selectedTeam, onTeam]);

  const select = (id: string, originEl?: HTMLElement | null) => {
    const box = stageBox.current?.getBoundingClientRect();
    const chip = originEl?.getBoundingClientRect();
    origin.current = box && chip ? Math.max(0, Math.min(100, ((chip.left + chip.width / 2 - box.left) / box.width) * 100)) : 50;
    navigate(buildHash("jogadores", id, { vs: compareId && compareId !== id ? compareId : null }), true);
  };

  // Atalhos ← → trocam de jogador na lista visível.
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const selectedRef = useRef(selected?.id);
  selectedRef.current = selected?.id;
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft") return;
      if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
      const target = ev.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [role=listbox], [role=dialog], .seg")) return;
      const list = visibleRef.current;
      if (!list.length) return;
      const index = list.findIndex((p) => p.id === selectedRef.current);
      const next = list[(index + (ev.key === "ArrowRight" ? 1 : -1) + list.length) % list.length];
      ev.preventDefault();
      const chip = document.querySelector<HTMLElement>(`.rail [data-id="${next.id}"]`);
      const box = stageBox.current?.getBoundingClientRect();
      const rect = chip?.getBoundingClientRect();
      origin.current = box && rect ? Math.max(0, Math.min(100, ((rect.left + rect.width / 2 - box.left) / box.width) * 100)) : 50;
      navigate(buildHash("jogadores", next.id, { vs: new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("vs") }), true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (featured.isPending) {
    return (
      <div className="page-players">
        <div className="hero">
          <div className="stage-tilt">
            <div className="stage stage-skeleton" aria-hidden="true" />
          </div>
          <Skeleton label="Carregando jogadores em destaque…" rows={4} />
        </div>
      </div>
    );
  }
  if (featured.isError && !featured.data) {
    return <ErrorState error={featured.error} onRetry={() => void featured.refetch()} title="Não foi possível carregar os jogadores" />;
  }

  const snapshotAt = featured.data?.source === "snapshot" ? featured.data.capturedAt : null;
  const missingNotFound = routeId && !all.has(routeId) && !extra.isFetching && (extra.data || extra.isError);
  const leadNote = snapshotAt
    ? "Médias do instantâneo offline, entre os jogadores em destaque."
    : `Entre os ${pool.length} jogadores em destaque, temporada ${pool.find((p) => p.seasonLabel)?.seasonLabel ?? "atual"}, dados da ESPN.`;

  return (
    <div className="page-players">
      {snapshotAt ? <SnapshotNotice capturedAt={snapshotAt} what="jogadores e médias" onRetry={() => void featured.refetch()} /> : null}
      {featured.data && featured.data.data.missing.length > 0 && !snapshotAt ? (
        <p className="notice notice-partial" role="status">
          <span className="notice-dot" aria-hidden="true" />
          {featured.data.data.missing.length} jogador(es) em destaque não vieram da fonte agora; a lista está parcial.
        </p>
      ) : null}
      {missingNotFound ? (
        <p className="notice notice-partial" role="status">
          <span className="notice-dot" aria-hidden="true" />
          Não encontramos o jogador do link na fonte. Mostrando um jogador em destaque.
        </p>
      ) : null}
      {selected ? (
        <section className="hero" aria-label={`Jogador em foco: ${selected.name}`}>
          <div ref={stageBox}>
            <Stage player={selected} originX={origin.current} />
          </div>
          <PlayerInfo
            player={selected}
            pool={pool}
            favorite={favorites.players.includes(selected.id)}
            onToggleFavorite={() => favorites.toggle("players", selected.id)}
            snapshotAt={snapshotAt}
          />
        </section>
      ) : (
        <Skeleton label="Carregando jogador…" rows={4} />
      )}

      <section className="roster" aria-labelledby="roster-title">
        <div className="roster-head">
          <h2 id="roster-title">Jogadores</h2>
          <label className="search">
            <span className="sr">Buscar jogador ou time na NBA</span>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              placeholder="Buscar jogador ou time"
              autoComplete="off"
              spellCheck={false}
              maxLength={40}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="seg" role="group" aria-label="Filtrar por posição">
            {POSITIONS.map((p) => (
              <button key={p.id} type="button" aria-pressed={pos === p.id} onClick={() => setPos(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <p className="sr" role="status" aria-live="polite">
          {deferred.length >= 3 && !searching ? `${visible.length + remote.length} jogadores na lista` : ""}
        </p>
        <Rail
          players={visible}
          remote={remote}
          selectedId={selected?.id ?? null}
          favorites={favorites.players}
          message={railMessage}
          onSelect={select}
          staggerKey={pos}
        />
      </section>

      {selected ? (
        <Lab
          player={selected}
          rival={rival}
          options={favoritesFirst([...all.values()].filter((p) => p.id !== selected.id && (p.featured || favorites.players.includes(p.id))), favorites.players)}
          pool={pool}
          lead={lead}
          onLead={setLead}
          onCompare={(id) => navigate(buildHash("jogadores", selected.id, { vs: id }), true)}
          onSelect={(id) => {
            select(id);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          leadNote={leadNote}
        />
      ) : null}
    </div>
  );
}
