import ReactDOM from "react-dom/client";

import { MarkdownStream } from "../ui/MarkdownStream.tsx";
import { rootElementId } from "../ui/ResponseContainer.tsx";

import "./main.css";

function init() {
  const rootElement = document.getElementById(rootElementId);
  if (!rootElement) return console.error("Root element not found");

  const responseId = rootElement.getAttribute("data-response-id");
  if (!responseId) return console.error("Response ID not found");

  ReactDOM.createRoot(rootElement).render(<MarkdownStream responseId={responseId} />);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
