import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { contrast, pickAccent } from "../../lib/color";
import { formatNumber, formatPct } from "../../lib/format";
import { swatch, teamPalette } from "../../lib/teams";
import { animate, EASE, prefersReducedMotion } from "../../lib/theme";
import { useThemeVars } from "../../lib/theme-context";
import { CountUp } from "./PlayerInfo";
import { AXES, duel, LEAD, radarValues, type PlayerView, type StatKey } from "./model";

const polar = (i: number, r: number): [number, number] => {
  const a = ((-90 + i * 60) * Math.PI) / 180;
  return [Math.cos(a) * r, Math.sin(a) * r];
};
const points = (values: number[]) => values.map((v, i) => polar(i, v * 100).map((n) => n.toFixed(1)).join(",")).join(" ");

/** Interpola uma lista de valores até o alvo (radar). */
function useTween(target: number[]) {
  const [values, setValues] = useState(target);
  const current = useRef(target);
  const key = target.join(",");
  useEffect(() => {
    const from = current.current;
    const to = key.split(",").map(Number);
    if (prefersReducedMotion()) {
      current.current = to;
      setValues(to);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / 750);
      const e = 1 - Math.pow(1 - k, 4);
      const next = from.map((v, i) => v + ((to[i] ?? v) - v) * e);
      current.current = next;
      setValues(next);
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [key]);
  return values;
}

export function Radar({ a, b, labelA, labelB }: { a: PlayerView; b: PlayerView | null; labelA: string; labelB: string | null }) {
  const va = useTween(radarValues(a.stats));
  const vb = useTween(b ? radarValues(b.stats) : AXES.map(() => 0));
  const description = AXES.map(([label, get]) => {
    const one = get(a.stats);
    const two = b ? get(b.stats) : undefined;
    return `${label}: ${formatNumber(one ?? null)}${b ? ` contra ${formatNumber(two ?? null)}` : ""}`;
  }).join("; ");
  return (
    <>
      <svg className="radar" viewBox="-175 -135 350 270" role="img" aria-label={`Perfil de jogo de ${labelA}${labelB ? ` comparado a ${labelB}` : ""}. ${description}.`}>
        {[0.25, 0.5, 0.75, 1].map((k) => (
          <polygon key={k} className="grid" points={AXES.map((_, i) => polar(i, 100 * k).map((n) => n.toFixed(1)).join(",")).join(" ")} />
        ))}
        {AXES.map(([label], i) => {
          const [x, y] = polar(i, 100);
          const [lx, ly] = polar(i, 116);
          const anchor = Math.abs(lx) < 5 ? "middle" : lx > 0 ? "start" : "end";
          return (
            <g key={label}>
              <line className="axis" x1="0" y1="0" x2={x.toFixed(1)} y2={y.toFixed(1)} />
              <text x={lx.toFixed(1)} y={(ly + 4).toFixed(1)} textAnchor={anchor}>
                {label}
              </text>
            </g>
          );
        })}
        {b ? <polygon className="pb" points={points(vb)} /> : null}
        <polygon className="pa" points={points(va)} />
        {va.map((v, i) => {
          const [x, y] = polar(i, v * 100);
          return <circle key={i} className="dot" cx={x.toFixed(1)} cy={y.toFixed(1)} r="3.5" />;
        })}
      </svg>
      <div className="legend" aria-hidden="true">
        <span>
          <i />
          {labelA}
        </span>
        {labelB ? (
          <span>
            <i className="b" />
            {labelB}
          </span>
        ) : null}
      </div>
    </>
  );
}

/** Seletor de comparação: lista própria (listbox) com teclado, no lugar do <select> nativo. */
export function ComparePicker({ options, value, onChange }: { options: PlayerView[]; value: PlayerView | null; onChange: (id: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const node = list.current;
    animate(node, [{ opacity: 0, transform: "translateY(-8px) scale(.96)" }, { opacity: 1, transform: "none" }], { duration: 240, easing: EASE });
    const current = node?.querySelector<HTMLElement>('[aria-selected="true"]') ?? (node?.firstElementChild as HTMLElement | null);
    current?.focus({ preventScroll: true });
    const outside = (ev: PointerEvent) => {
      if (!box.current?.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  const choose = (id: string | null) => {
    onChange(id);
    setOpen(false);
    button.current?.focus();
  };

  const onKeyDown = (ev: KeyboardEvent<HTMLElement>) => {
    if (ev.key === "Escape" && open) {
      ev.stopPropagation();
      setOpen(false);
      button.current?.focus();
      return;
    }
    const item = (ev.target as HTMLElement).closest("li");
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      if (!open) return setOpen(true);
      const next = !item ? list.current?.firstElementChild : ev.key === "ArrowDown" ? item.nextElementSibling : item.previousElementSibling;
      (next as HTMLElement | null)?.focus();
    } else if (ev.key === "Home" || ev.key === "End") {
      if (!open) return;
      ev.preventDefault();
      ((ev.key === "Home" ? list.current?.firstElementChild : list.current?.lastElementChild) as HTMLElement | null)?.focus();
    } else if (item && (ev.key === "Enter" || ev.key === " ")) {
      ev.preventDefault();
      choose(item.dataset.id || null);
    }
  };

  return (
    <div className="cmpx" ref={box}>
      <button className="cmp" type="button" ref={button} onKeyDown={onKeyDown} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} onClick={() => setOpen(!open)}>
        <span>{value ? value.name : "Comparar com…"}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <ul className="cmp-list" id={listId} ref={list} role="listbox" aria-label="Comparar com outro jogador" hidden={!open} onKeyDown={onKeyDown}>
        {value ? (
          <li className="none" role="option" tabIndex={-1} data-id="" aria-selected={false} onClick={() => choose(null)} onKeyDown={onKeyDown}>
            Tirar a comparação
          </li>
        ) : null}
        {options.map((p) => {
          const palette = teamPalette(p.team, p.name);
          return (
            <li key={p.id} role="option" tabIndex={-1} data-id={p.id} aria-selected={p.id === value?.id} onClick={() => choose(p.id)} onKeyDown={onKeyDown}>
              <b className="sw" style={swatch(palette)} aria-hidden="true">
                {p.jersey ?? ""}
              </b>
              <span>{p.name}</span>
              <em>{palette.abbr}</em>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function DuelTable({ a, b }: { a: PlayerView; b: PlayerView }) {
  const result = duel(a.stats, b.stats);
  const short = (p: PlayerView) => p.last || p.name;
  return (
    <div className="duel">
      <table className="duel-table">
        <caption className="sr">
          Frente a frente: {a.name} contra {b.name}
        </caption>
        <thead>
          <tr className="duel-head">
            <th scope="col">
              <i aria-hidden="true" />
              {a.name}
            </th>
            <th scope="col">
              <span className="sr">Quesito</span>
            </th>
            <th scope="col">
              {b.name}
              <i aria-hidden="true" />
            </th>
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row) => {
            const max = Math.max(row.a ?? 0, row.b ?? 0) || 1;
            const fmt = (v: number | null) => (row.unit === "%" ? formatPct(v) : formatNumber(v));
            return (
              <tr className="duel-row" key={row.label}>
                <td className={row.winner === "a" ? "win" : ""}>
                  {fmt(row.a)}
                  {row.winner === "a" ? <span className="sr"> (melhor)</span> : null}
                  <span className="duel-bar l" style={{ "--w": ((row.a ?? 0) / max).toFixed(3) } as CSSProperties} aria-hidden="true" />
                </td>
                <th scope="row">{row.label}</th>
                <td className={row.winner === "b" ? "win" : ""}>
                  {fmt(row.b)}
                  {row.winner === "b" ? <span className="sr"> (melhor)</span> : null}
                  <span className="duel-bar r" style={{ "--w": ((row.b ?? 0) / max).toFixed(3) } as CSSProperties} aria-hidden="true" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="duel-sum">
        {short(a)} leva {result.winsA} de {result.rows.length} quesitos, {short(b)} leva {result.winsB}.
      </p>
    </div>
  );
}

function ShotCard({ player, rival }: { player: PlayerView; rival: PlayerView | null }) {
  const s = player.stats;
  const has = (...keys: StatKey[]) => keys.every((k) => typeof s[k] === "number");
  const tiles: [number | null, string][] = [
    [has("pts", "reb", "ast") ? (s.pts ?? 0) + (s.reb ?? 0) + (s.ast ?? 0) : null, "Pontos, rebotes e assistências somados"],
    [has("pts", "min") && (s.min ?? 0) > 0 ? ((s.pts ?? 0) / (s.min ?? 1)) * 36 : null, "Pontos a cada 36 minutos"],
    [has("stl", "blk") ? (s.stl ?? 0) + (s.blk ?? 0) : null, "Roubos e tocos por jogo"],
    [s.min ?? null, "Minutos em quadra por jogo"],
  ];
  return (
    <div className="card">
      <h3>{rival ? "Frente a frente" : "Arremesso"}</h3>
      {rival ? (
        <DuelTable a={player} b={rival} />
      ) : (
        <>
          <div className="rings">
            {(
              [
                ["fg", "De quadra"],
                ["tp", "De três"],
                ["ft", "Lance livre"],
              ] as [StatKey, string][]
            ).map(([key, label]) => {
              const v = s[key] ?? null;
              return (
                <div className="ring" key={key}>
                  <svg viewBox="0 0 80 80" aria-hidden="true" focusable="false">
                    <circle className="rt" cx="40" cy="40" r="34" />
                    <circle className="rv" cx="40" cy="40" r="34" pathLength={100} transform="rotate(-90 40 40)" style={{ strokeDashoffset: v === null ? 100 : (100 - Math.min(100, v)).toFixed(1) }} />
                  </svg>
                  <b>
                    <CountUp value={v} unit="%" />
                  </b>
                  <span>{label}</span>
                </div>
              );
            })}
          </div>
          <div className="tiles">
            {tiles.map(([v, label]) => (
              <div key={label}>
                <b>
                  <CountUp value={v} />
                </b>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Leaders({ pool, selectedId, lead, onLead, onSelect, note }: {
  pool: PlayerView[];
  selectedId: string;
  lead: StatKey;
  onLead: (key: StatKey) => void;
  onSelect: (id: string) => void;
  note: string;
}) {
  const conf = LEAD.find((l) => l.key === lead) ?? LEAD[0];
  const ranked = pool.filter((p) => p.featured && typeof p.stats[lead] === "number").sort((x, y) => (y.stats[lead] as number) - (x.stats[lead] as number));
  const rows: [PlayerView, number][] = ranked.slice(0, 5).map((p, i) => [p, i + 1]);
  const at = ranked.findIndex((p) => p.id === selectedId);
  if (at >= 5) rows.push([ranked[at], at + 1]);
  const max = (ranked[0]?.stats[lead] as number | undefined) ?? 1;
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    list.current?.querySelectorAll(".lb i").forEach((bar, i) =>
      animate(bar, [{ transform: "scaleX(0)" }, { transform: (bar as HTMLElement).style.transform }], { duration: 800, delay: i * 70, easing: EASE, fill: "backwards" }),
    );
  }, [lead]);
  const surface = useThemeVars()["--surface"];
  return (
    <div className="card">
      <h3>Ranking dos destaques</h3>
      <div className="seg seg-grid" role="group" aria-label="Estatística do ranking">
        {LEAD.map((l) => (
          <button key={l.key} type="button" aria-pressed={l.key === lead} onClick={() => onLead(l.key)}>
            {l.label}
          </button>
        ))}
      </div>
      <ol className="leaders" ref={list}>
        {rows.map(([p, rank]) => {
          const value = p.stats[lead] as number;
          const color = pickAccent(teamPalette(p.team, p.name), surface);
          return (
            <li key={p.id}>
              <button className="lrow" type="button" aria-current={p.id === selectedId} onClick={() => onSelect(p.id)}>
                <span className="rk">{rank}º</span>
                <span className="nm">{p.name}</span>
                <span className="vl">
                  {formatNumber(value)}
                  {conf.unit}
                </span>
                <span className="lb" aria-hidden="true">
                  <i style={{ background: color, transform: `scaleX(${(value / max).toFixed(3)})` }} />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="lead-note">{note}</p>
    </div>
  );
}

export function Lab({ player, rival, options, pool, lead, onLead, onCompare, onSelect, leadNote }: {
  player: PlayerView;
  rival: PlayerView | null;
  options: PlayerView[];
  pool: PlayerView[];
  lead: StatKey;
  onLead: (key: StatKey) => void;
  onCompare: (id: string | null) => void;
  onSelect: (id: string) => void;
  leadNote: string;
}) {
  const lab = useRef<HTMLElement>(null);
  const vars = useThemeVars();
  const rivalAccent = rival ? pickAccent(teamPalette(rival.team, rival.name), vars["--surface"]) : null;
  // Cor do adversário; se for parecida com a do jogador, usa a tinta.
  const rivalColor = rivalAccent && contrast(rivalAccent, vars["--accent"]) < 1.3 ? vars["--ink"] : rivalAccent;

  useEffect(() => {
    const node = lab.current;
    if (!node) return;
    if (!("IntersectionObserver" in window) || prefersReducedMotion()) {
      node.classList.add("in");
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        node.classList.add("in");
        io.disconnect();
      }
    }, { threshold: 0.12 });
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <section className="lab reveal" ref={lab} aria-labelledby="lab-title" style={rival && rivalColor ? ({ "--rival": rivalColor } as CSSProperties) : undefined}>
      <h2 id="lab-title">Raio-x</h2>
      <div className="lab-grid">
        <div className="card">
          <div className="card-head">
            <h3>Perfil de jogo</h3>
            <ComparePicker options={options} value={rival} onChange={onCompare} />
          </div>
          <Radar a={player} b={rival} labelA={player.name} labelB={rival?.name ?? null} />
        </div>
        <ShotCard player={player} rival={rival} />
        <Leaders pool={pool} selectedId={player.id} lead={lead} onLead={onLead} onSelect={onSelect} note={leadNote} />
      </div>
    </section>
  );
}
