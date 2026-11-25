import { useEffect, useRef, useState } from "react";
import { mix } from "../../lib/color";
import { animate, EASE, prefersReducedMotion } from "../../lib/theme";
import { inkOn } from "../../lib/color";
import { numberColor, teamPalette } from "../../lib/teams";
import type { PlayerView } from "./model";

/** Palco: cor do time entrando em círculo a partir do jogador clicado, número da camisa e foto. */
export function Stage({ player, originX }: { player: PlayerView; originX: number }) {
  const stage = useRef<HTMLDivElement>(null);
  const bg = useRef<HTMLDivElement>(null);
  const court = useRef<SVGSVGElement>(null);
  const num = useRef<HTMLDivElement>(null);
  const sheen = useRef<HTMLDivElement>(null);
  const [photo, setPhoto] = useState<{ id: string; src: string } | null>(null);
  const palette = teamPalette(player.team, player.name);
  const ink = inkOn(palette.primary);

  useEffect(() => {
    const container = bg.current;
    if (!container) return;
    const layer = document.createElement("div");
    layer.className = "stage-layer";
    layer.style.background = `radial-gradient(90% 70% at 30% 8%, ${mix(palette.primary, "#FFFFFF", 0.2)} 0%, ${palette.primary} 55%, ${mix(palette.primary, "#000000", 0.3)} 100%)`;
    container.append(layer);
    const clean = () => {
      while (layer.previousSibling) layer.previousSibling.remove();
    };
    const first = container.children.length === 1;
    const wipe = first
      ? null
      : animate(layer, [{ clipPath: `circle(0% at ${originX}% 100%)` }, { clipPath: `circle(150% at ${originX}% 100%)` }], { duration: 760, easing: EASE });
    if (wipe) wipe.onfinish = clean;
    else clean();
    animate(num.current, [{ opacity: 0, transform: "translateY(26%) scale(.9)" }, { opacity: 1, transform: "none" }], { duration: 700, delay: 160, easing: EASE, fill: "backwards" });
    [...(court.current?.children ?? [])].forEach((shape, i) =>
      animate(shape, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 950, delay: 160 + i * 70, easing: "ease-out", fill: "backwards" }),
    );
    animate(sheen.current, [{ transform: "translateX(-140%) skewX(-12deg)" }, { transform: "translateX(340%) skewX(-12deg)" }], { duration: 900, delay: 300, easing: "ease-in-out" });
    // originX só vale para a transição em curso; não refaz o efeito quando muda sozinho.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.id, palette.primary]);

  /** A arte da camisa fica sempre por baixo; a foto só aparece se carregar de verdade. */
  useEffect(() => {
    const src = player.headshot;
    if (!src) return;
    let alive = true;
    const probe = new Image();
    probe.onload = () => {
      if (alive && probe.naturalWidth >= 40) setPhoto({ id: player.id, src });
    };
    probe.src = src;
    return () => {
      alive = false;
    };
  }, [player.id, player.headshot]);

  const showPhoto = photo?.id === player.id;

  useEffect(() => {
    const node = stage.current;
    if (!node || !window.matchMedia("(hover:hover) and (pointer:fine)").matches) return;
    const move = (ev: PointerEvent) => {
      if (prefersReducedMotion()) return;
      const r = node.getBoundingClientRect();
      node.style.setProperty("--px", ((ev.clientX - r.left) / r.width - 0.5).toFixed(3));
      node.style.setProperty("--py", ((ev.clientY - r.top) / r.height - 0.5).toFixed(3));
    };
    const leave = () => {
      node.style.setProperty("--px", "0");
      node.style.setProperty("--py", "0");
    };
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerleave", leave);
    return () => {
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerleave", leave);
    };
  }, []);

  const strip = [player.name, palette.abbr || palette.name, player.jersey ? `Camisa ${player.jersey}` : null].filter(Boolean) as string[];

  return (
    <div className="stage-tilt">
      <div
        className={`stage${showPhoto ? " has-photo" : ""}`}
        ref={stage}
        style={{ "--stage-ink": ink, "--num": numberColor(palette), background: palette.primary } as React.CSSProperties}
      >
        <div className="stage-bg" ref={bg} />
        <svg className="court" ref={court} viewBox="0 0 500 470" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
          <rect pathLength={1} x="1" y="1" width="498" height="468" />
          <path pathLength={1} d="M190 0A60 60 0 0 0 310 0" />
          <path pathLength={1} d="M30 470V330A237.5 237.5 0 0 1 470 330V470" />
          <rect pathLength={1} x="170" y="280" width="160" height="190" />
          <circle pathLength={1} cx="250" cy="280" r="60" />
          <path pathLength={1} d="M210 417.5A40 40 0 0 1 290 417.5" />
          <path pathLength={1} d="M220 430H280" />
          <circle pathLength={1} cx="250" cy="417.5" r="7.5" />
        </svg>
        <div className="jersey-num" ref={num} data-len={(player.jersey ?? "").length} aria-hidden="true">
          {player.jersey ?? ""}
        </div>
        {showPhoto ? <img className="photo is-ready" src={photo.src} alt={`Foto de ${player.name}`} decoding="async" /> : null}
        <div className="sheen" ref={sheen} />
        <div className="stage-head">
          <span>{palette.name}</span>
          <span>{player.posName ?? ""}</span>
        </div>
        <div className="ticker" aria-hidden="true">
          <div>
            {Array.from({ length: 8 }, (_, i) => strip.map((text, j) => <span key={`${i}-${j}`}>{text}</span>))}
          </div>
        </div>
      </div>
    </div>
  );
}
