import { useEffect, useRef } from "react";
import { EASE, prefersReducedMotion } from "../lib/theme";

const WORD = [..."Garrafão"];

/** Abertura: a bola quica e "engole" a tela. Pulável com clique, toque ou qualquer tecla. */
export function Intro({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const ball = useRef<SVGSVGElement>(null);
  const shadow = useRef<HTMLDivElement>(null);
  const word = useRef<HTMLDivElement>(null);
  const skipButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const overlay = root.current;
    const ballWrap = wrap.current;
    const ballSvg = ball.current;
    const ballShadow = shadow.current;
    const introWord = word.current;
    if (!overlay || !ballWrap || !ballSvg || !ballShadow || !introWord || prefersReducedMotion() || typeof ballWrap.animate !== "function") {
      onDone();
      return;
    }
    skipButton.current?.focus({ preventScroll: true });
    const running: Animation[] = [];
    let done = false;
    const finish = (fast: boolean) => {
      if (done) return;
      done = true;
      window.removeEventListener("keydown", skip);
      const out = overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fast ? 180 : 420, easing: "ease-out", fill: "forwards" });
      out.onfinish = () => {
        running.forEach((a) => a.cancel());
        onDone();
      };
    };
    const skip = () => finish(true);
    overlay.addEventListener("click", skip);
    window.addEventListener("keydown", skip);

    const vh = window.innerHeight;
    const Y = (pct: number) => `translateY(${(-pct * vh) / 100}px)`;
    const fall = "cubic-bezier(.5,0,1,.6)";
    const rise = "cubic-bezier(0,.4,.5,1)";
    const frames: [number, number, number, number, string][] = [
      [0, 62, 1, 1, fall],
      [0.24, 0, 1.2, 0.76, rise],
      [0.43, 30, 0.96, 1.05, fall],
      [0.61, 0, 1.13, 0.85, rise],
      [0.73, 12, 1, 1, fall],
      [0.84, 0, 1.07, 0.92, rise],
      [0.91, 3, 1, 1, fall],
      [1, 0, 1, 1, "linear"],
    ];
    const bounce = ballWrap.animate(
      frames.map(([offset, y, sx, sy, easing]) => ({ offset, easing, transform: `${Y(y)} scale(${sx},${sy})` })),
      { duration: 1900, fill: "both" },
    );
    running.push(
      bounce,
      ballSvg.animate([{ transform: "rotate(-220deg)" }, { transform: "rotate(340deg)" }], { duration: 1900, easing: "cubic-bezier(.1,.6,.3,1)", fill: "both" }),
      ballShadow.animate(
        frames.map(([offset, y]) => ({ offset, opacity: 0.65 - Math.min(0.55, y / 70), transform: `scale(${1 - Math.min(0.7, y / 80)})` })),
        { duration: 1900, fill: "both" },
      ),
    );
    [...introWord.children].forEach((span, i) =>
      running.push(span.animate([{ transform: "translateY(110%)" }, { transform: "none" }], { duration: 560, delay: 480 + i * 55, easing: EASE, fill: "both" })),
    );
    bounce.finished
      .then(() => {
        if (done) return;
        ballWrap.style.transformOrigin = "50% 50%";
        const zoom = ballWrap.animate(
          [{ transform: "scale(1)" }, { transform: `scale(${Math.ceil(Math.hypot(window.innerWidth, window.innerHeight) / 50)})` }],
          { duration: 620, delay: 260, easing: "cubic-bezier(.7,0,.9,.4)", fill: "both" },
        );
        running.push(zoom, introWord.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, delay: 260, fill: "both" }));
        zoom.finished.then(() => finish(false)).catch(() => undefined);
      })
      .catch(() => undefined);
    return () => {
      done = true;
      window.removeEventListener("keydown", skip);
      overlay.removeEventListener("click", skip);
      running.forEach((a) => a.cancel());
    };
  }, [onDone]);

  return (
    <div className="intro" ref={root} data-testid="intro">
      <div className="intro-floor" />
      <div className="ball-shadow" ref={shadow} />
      <div className="ball-wrap" ref={wrap}>
        <svg className="ball" ref={ball} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
          <defs>
            <radialGradient id="introBall" cx="35%" cy="30%" r="75%">
              <stop offset="0" stopColor="#FFA24D" />
              <stop offset=".6" stopColor="#E8732A" />
              <stop offset="1" stopColor="#A9480F" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="48" fill="url(#introBall)" />
          <path d="M50 2V98M2 50H98M17 15C36 34 36 66 17 85M83 15C64 34 64 66 83 85" fill="none" stroke="#1B1208" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      </div>
      <div className="intro-word" ref={word} aria-hidden="true">
        {WORD.map((c, i) => (
          <span key={i}>{c}</span>
        ))}
      </div>
      <button type="button" className="intro-skip" ref={skipButton}>
        Pular abertura
      </button>
    </div>
  );
}
