import ReactDOM from "react-dom/client";

import { rootElementId } from "../ui/DocumentContainer.tsx";
import { MarkdownStream } from "../ui/MarkdownStream.tsx";

import "./main.css";

type DocumentPayload = {
  markdownUrl: string;
};

function init() {
  const rootElement = document.getElementById(rootElementId);
  const container = rootElement ?? document.body;

  try {
    if (!rootElement) throw new Error("Root element not found");
    const raw = rootElement.getAttribute("data-document");
    if (!raw) throw new Error("Document payload not found");
    const dataDocument = JSON.parse(raw) as DocumentPayload;
    if (!dataDocument.markdownUrl) throw new Error("markdownUrl not found");

    ReactDOM.createRoot(container).render(<MarkdownStream markdownUrl={dataDocument.markdownUrl} />);
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
