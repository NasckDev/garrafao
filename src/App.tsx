import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TeamRef } from "../server/types";
import { usePlayers } from "./api/hooks";
import { Footer } from "./components/Footer";
import { Header, type SourceMode } from "./components/Header";
import { Intro } from "./components/Intro";
import { Skeleton } from "./components/states";
import { FEATURED_IDS } from "./config/featured";
import { themeVars } from "./lib/color";
import { formatDateTime } from "./lib/format";
import { TABS, useRoute } from "./lib/router";
import { introSeen, markIntroSeen } from "./lib/storage";
import { DEFAULT_PALETTE, teamPalette } from "./lib/teams";
import { useDocumentTheme } from "./lib/theme";
import { ThemeVarsContext } from "./lib/theme-context";
import { PlayersPage } from "./features/players/PlayersPage";

const LivePage = lazy(() => import("./features/live/LivePage").then((m) => ({ default: m.LivePage })));
const StandingsPage = lazy(() => import("./features/standings/StandingsPage").then((m) => ({ default: m.StandingsPage })));
const EventsPage = lazy(() => import("./features/events/EventsPage").then((m) => ({ default: m.EventsPage })));
const NewsPage = lazy(() => import("./features/news/NewsPage").then((m) => ({ default: m.NewsPage })));
const FavoritesPage = lazy(() => import("./features/favorites/FavoritesPage").then((m) => ({ default: m.FavoritesPage })));

const now = () => new Date();

export function App() {
  const route = useRoute();
  const [intro, setIntro] = useState(() => !introSeen());
  const [team, setTeam] = useState<TeamRef | null>(null);
  const palette = useMemo(() => (team ? teamPalette(team) : DEFAULT_PALETTE), [team]);
  const dark = useDocumentTheme(palette);
  const vars = useMemo(() => themeVars(palette, dark), [palette, dark]);
  const featured = usePlayers(FEATURED_IDS, { fallback: true });
  const main = useRef<HTMLElement>(null);
  const previousTab = useRef(route.tab);

  const source: SourceMode = featured.data
    ? featured.data.source === "snapshot"
      ? "snapshot"
      : "live"
    : featured.isError
      ? "down"
      : "probing";
  const capturedAt = featured.data?.capturedAt ?? null;

  const finishIntro = useCallback(() => {
    markIntroSeen();
    setIntro(false);
  }, []);

  useEffect(() => {
    const label = TABS.find((t) => t.id === route.tab)?.label ?? "Jogadores";
    document.title = `${label} · Garrafão, NBA com dados públicos`;
    if (previousTab.current !== route.tab) {
      previousTab.current = route.tab;
      main.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0 });
    }
  }, [route.tab]);

  const dataText =
    source === "live"
      ? "Dados públicos da ESPN, lidos por um proxy próprio com cache na CDN: fotos, médias da temporada, placares, classificação e calendário."
      : source === "snapshot" && capturedAt
        ? `Sem conexão com a fonte: jogadores e classificação vêm do instantâneo offline gravado em ${formatDateTime(capturedAt)}.`
        : source === "down"
          ? "A fonte de dados não respondeu e não há instantâneo para esta tela."
          : "Conectando à ESPN…";

  return (
    <ThemeVarsContext.Provider value={vars}>
      {intro ? <Intro onDone={finishIntro} /> : null}
      <a className="skip" href="#conteudo" onClick={(event) => {
        event.preventDefault();
        main.current?.focus();
      }}>
        Pular para o conteúdo
      </a>
      <div className="glow-wrap" aria-hidden="true">
        <div className="glow" />
      </div>
      <div className="wrap">
        <Header tab={route.tab} source={source} capturedAt={capturedAt} onBrand={() => setIntro(true)} onRetrySource={() => void featured.refetch()} />
        <main id="conteudo" ref={main} tabIndex={-1}>
          <Suspense fallback={<Skeleton label="Carregando a seção…" rows={4} />}>
            {route.tab === "jogadores" ? <PlayersPage route={route} onTeam={setTeam} /> : null}
            {route.tab === "favoritos" ? <FavoritesPage /> : null}
            {route.tab === "ao-vivo" ? <LivePage route={route} now={now} /> : null}
            {route.tab === "classificacao" ? <StandingsPage /> : null}
            {route.tab === "eventos" ? <EventsPage now={now} /> : null}
            {route.tab === "noticias" ? <NewsPage /> : null}
          </Suspense>
        </main>
        <Footer dataText={dataText} />
      </div>
    </ThemeVarsContext.Provider>
  );
}
