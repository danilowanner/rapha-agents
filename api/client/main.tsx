import "@mantine/core/styles.css";

import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ReactDOM from "react-dom/client";

import { clientAppRootId, type AppPayload } from "../ui/ClientApp.tsx";
import { App } from "./App.tsx";

import "./main.css";

const queryClient = new QueryClient();

function init() {
  const rootElement = document.getElementById(clientAppRootId);
  const container = rootElement ?? document.body;

  try {
    if (!rootElement) throw new Error("Root element not found");
    const raw = rootElement.getAttribute("data-payload");
    if (!raw) throw new Error("Payload not found");
    const payload = JSON.parse(raw) as AppPayload;
    ReactDOM.createRoot(container).render(
      <MantineProvider>
        <QueryClientProvider client={queryClient}>
          <App payload={payload} />
        </QueryClientProvider>
      </MantineProvider>,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ReactDOM.createRoot(container).render(<div role="alert">{message}</div>);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
