import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "../lib/theme";
import { Ball } from "./bits";

const WORD = [..."Garrafão"];

export function Footer({ dataText }: { dataText: string }) {
  const foot = useRef<HTMLElement>(null);
  const mark = useRef<HTMLDivElement>(null);

  /** A marca do rodapé ocupa a largura inteira, seja qual for a fonte carregada. */
  useEffect(() => {
    const word = mark.current;
    if (!word) return;
    const fit = () => {
      const first = word.firstElementChild as HTMLElement | null;
      const last = word.lastElementChild as HTMLElement | null;
      if (!first || !last) return;
      word.style.fontSize = "";
      const content = last.offsetLeft + last.offsetWidth - first.offsetLeft;
      if (content > 0) word.style.fontSize = `${((parseFloat(getComputedStyle(word).fontSize) * word.clientWidth) / content) * 0.99}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    void document.fonts?.ready.then(fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    const node = foot.current;
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
    }, { threshold: 0.1 });
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <footer className="foot" ref={foot}>
      <div className="foot-grid">
        <div>
          <h2 className="foot-h">Garrafão</h2>
          <p>Um preview de jogadores da NBA feito como estudo de interface: cada jogador pinta a página com as cores do seu time.</p>
          <button className="totop" type="button" onClick={() => window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" })}>
            <Ball />
            Voltar ao topo
          </button>
        </div>
        <div>
          <h2 className="foot-h">Dados</h2>
          <p>{dataText}</p>
        </div>
        <div>
          <h2 className="foot-h">Atalhos</h2>
          <ul>
            <li>
              <kbd>←</kbd>
              <kbd>→</kbd> Trocar de jogador
            </li>
            <li>
              <kbd>Esc</kbd> Fechar listas e painéis
            </li>
            <li>Clique no logo para rever a abertura</li>
          </ul>
        </div>
      </div>
      <div className="wordmark" ref={mark} aria-hidden="true">
        {WORD.map((c, i) => (
          <span key={i} style={{ "--i": i } as React.CSSProperties}>
            {c}
          </span>
        ))}
      </div>
      <div className="foot-legal">
        <span>Projeto de estudo, sem vínculo com a NBA ou a ESPN.</span>
        <span>Nomes, fotos e cores dos times pertencem aos seus donos.</span>
      </div>
    </footer>
  );
}
