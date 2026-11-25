import "@fontsource/big-shoulders-display/600";
import "@fontsource/big-shoulders-display/800";
import "@fontsource/big-shoulders-display/900";
import "@fontsource/schibsted-grotesk/400";
import "@fontsource/schibsted-grotesk/500";
import "@fontsource/schibsted-grotesk/600";
import "@fontsource/schibsted-grotesk/700";
import "./styles/app.css";
import "./styles/pages.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { isRetryable } from "./api/client";
import { App } from "./App";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Repete só o que pode mudar tentando de novo (rede, origem fora), com espera crescente.
      retry: (count, error) => count < 2 && isRetryable(error),
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      refetchOnWindowFocus: true,
    },
  },
});

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  );
}
