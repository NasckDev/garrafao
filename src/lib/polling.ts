import { useEffect, useState, useSyncExternalStore } from "react";

/** Intervalo de atualização do placar: alinhado ao s-maxage do proxy para jogo ao vivo. */
export const LIVE_POLL_MS = 15_000;

/**
 * Regra do polling: só atualiza sozinho quando há jogo ao vivo E a aba está visível.
 * Em segundo plano ou sem jogo em andamento, não gasta rede (e a CDN fica com menos acessos).
 */
export function liveRefetchInterval(hasLive: boolean | undefined, visible: boolean): number | false {
  return hasLive && visible ? LIVE_POLL_MS : false;
}

function subscribeVisibility(callback: () => void) {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}

export function usePageVisible(): boolean {
  return useSyncExternalStore(subscribeVisibility, () => document.visibilityState !== "hidden", () => true);
}

/** Segundos desde `since` (ms), atualizados a cada segundo enquanto a aba está visível. */
export function useSecondsSince(since: number | undefined): number | null {
  const visible = usePageVisible();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since || !visible) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [since, visible]);
  if (!since) return null;
  return Math.max(0, Math.round((now - since) / 1000));
}
