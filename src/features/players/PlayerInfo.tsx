import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { FavButton } from "../../components/bits";
import { formatNumber, heightM, weightKg } from "../../lib/format";
import { prefersReducedMotion } from "../../lib/theme";
import { teamPalette } from "../../lib/teams";
import { rankText, type PlayerView } from "./model";

/** Número que conta até o valor (sem movimento quando o usuário pede menos animação). */
export function CountUp({ value, decimals = 1, unit = "" }: { value: number | null | undefined; decimals?: number; unit?: string }) {
  const [shown, setShown] = useState<number | null>(value ?? null);
  useEffect(() => {
    if (value === null || value === undefined || prefersReducedMotion()) {
      setShown(value ?? null);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / 850);
      setShown(value * (1 - Math.pow(1 - k, 3)));
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return (
    <>
      {formatNumber(shown, decimals)}
      {shown === null ? "" : unit}
    </>
  );
}

/** Quebra o sobrenome só depois de hífen ou espaço ("Gilgeous-" / "Alexander"), nunca no meio da palavra. */
function splitWords(last: string) {
  const parts = last.split(/(?<=[-s])/);
  let start = 0;
  return parts.map((text) => {
    const part = { text, start };
    start += [...text].length;
    return part;
  });
}

const MIN_NAME_PX = 40;

function useFitName(dep: string) {
  const ref = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    const heading = ref.current;
    if (!heading) return;
    const fit = () => {
      const box = heading.parentElement?.clientWidth ?? 0;
      heading.style.fontSize = "";
      heading.style.whiteSpace = "nowrap";
      const max = parseFloat(getComputedStyle(heading).fontSize);
      const width = heading.scrollWidth;
      if (box > 0 && width > box) {
        const size = Math.max(MIN_NAME_PX, Math.floor(((max * box) / width) * 0.98));
        heading.style.fontSize = `${size}px`;
        if (size === MIN_NAME_PX) heading.style.whiteSpace = "normal";
      }
    };
    fit();
    window.addEventListener("resize", fit);
    void document.fonts?.ready.then(fit);
    return () => window.removeEventListener("resize", fit);
  }, [dep]);
  return ref;
}

export function statsNote(player: PlayerView, snapshotAt: string | null): string {
  const season = player.seasonLabel ? `da temporada ${player.seasonLabel}` : "da temporada atual";
  if (snapshotAt) return `Médias ${season} no instantâneo offline de ${new Date(snapshotAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`;
  if (player.statsKind === "season") {
    const games = player.stats.gp ? ` (${formatNumber(player.stats.gp, 0)} jogos)` : "";
    return `Médias por jogo ${season}, direto da ESPN${games}.`;
  }
  if (player.statsKind === "summary") return `Resumo ${season} publicado pela ESPN; as médias detalhadas não vieram.`;
  return "A ESPN ainda não publicou médias deste jogador na temporada.";
}

export function PlayerInfo({ player, pool, favorite, onToggleFavorite, snapshotAt }: {
  player: PlayerView;
  pool: PlayerView[];
  favorite: boolean;
  onToggleFavorite: () => void;
  snapshotAt: string | null;
}) {
  const palette = teamPalette(player.team, player.name);
  const heading = useFitName(player.id);
  const s = player.stats;
  const big: [keyof typeof s, string][] = [
    ["pts", "Pontos"],
    ["reb", "Rebotes"],
    ["ast", "Assistências"],
  ];
  return (
    <div className="info" key={player.id}>
      <div className="info-in">
        <div className="first-row">
          <p className="first">{player.first}</p>
          <FavButton active={favorite} name={player.name} kind="player" onToggle={onToggleFavorite} />
        </div>
        <h1 className="last go" ref={heading} aria-label={player.name}>
          {splitWords(player.last).map(({ text, start }) => (
            <span className="word" key={start} aria-hidden="true">
              {[...text].map((c, j) => (
                <span className="ch" style={{ "--i": start + j } as CSSProperties} key={j}>
                  {c}
                </span>
              ))}
            </span>
          ))}
        </h1>
        <div className="meta">
          <span className="tag team">{palette.name}</span>
          {player.posName ? <span className="tag">{player.posName}</span> : null}
          {player.jersey ? <span className="tag">Camisa {player.jersey}</span> : null}
        </div>
        <div className="big3">
          {big.map(([key, label]) => (
            <div key={key}>
              <b>
                <CountUp value={s[key]} />
              </b>
              <span>{label}</span>
              <small>{rankText(player, pool, key)}</small>
            </div>
          ))}
        </div>
        <p className="note">{statsNote(player, snapshotAt)}</p>
        <dl className="bio">
          <div>
            <dt>Altura</dt>
            <dd>{heightM(player.heightIn)}</dd>
          </div>
          <div>
            <dt>Peso</dt>
            <dd>{weightKg(player.weightLb)}</dd>
          </div>
          <div>
            <dt>Idade</dt>
            <dd>{player.age ? `${player.age} anos` : "–"}</dd>
          </div>
          <div>
            <dt>Origem</dt>
            <dd>{player.from ?? "–"}</dd>
          </div>
          <div>
            <dt>Draft</dt>
            <dd>{player.draft ?? "–"}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
