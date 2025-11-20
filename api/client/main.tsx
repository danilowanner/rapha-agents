import markdownIt from "markdown-it-ts";
import ReactDOM from "react-dom/client";

import { rootElementId } from "../ui/ResponseContainer.tsx";

import "./main.css";

const md = markdownIt({ stream: true });

declare global {
  interface Window {
    Rapha: {
      chunks: string[];
      listeners: ((html: string) => void)[];
      pushChunk: (chunk: string) => void;
      notify: () => void;
      subscribe: (fn: (html: string) => void) => void;
      init: () => void;
    };
  }
}

window.Rapha = window.Rapha || {
  chunks: [],
  listeners: [],
  subscribe: function (fn) {
    if (typeof fn === "function") this.listeners.push(fn);
  },
  notify: function () {
    const markdown = this.chunks.join("");
    const html = md.render(markdown);
    this.listeners.forEach(function (fn) {
      fn(html);
    });
  },
  pushChunk: function (chunk) {
    this.chunks.push(chunk);
    this.notify();
  },
  init: function () {
    const rootElement = document.getElementById(rootElementId);

    if (rootElement) {
      const root = ReactDOM.createRoot(rootElement);
      console.log("Create root", root);

      const render = (html: string) => {
        root.render(<div dangerouslySetInnerHTML={{ __html: html }} />);
      };

      const markdown = window.Rapha.chunks.join("");
      const html = md.render(markdown);
      render(html);
      window.Rapha.subscribe(render);
    }
  },
};
