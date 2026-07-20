import markdownIt from "markdown-it-ts";
import morphdom from "morphdom";
import { useEffect, useRef } from "react";

import "./MarkdownViewer.css";

const md = markdownIt();

type Props = {
  markdownUrl: string;
};

/** Displays streamed Markdown content. */
export function MarkdownViewer({ markdownUrl }: Props) {
  return (
    <div className="document markdown-content">
      <MarkdownStream markdownUrl={markdownUrl} />
    </div>
  );
}

function MarkdownStream({ markdownUrl }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let content = "";

    const fetchStream = async (retry = true): Promise<void> => {
      try {
        const response = await fetch(markdownUrl);
        if (!response.ok || !response.body) throw new Error("Failed to fetch");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          content += decoder.decode(value, { stream: true });
          const cleanedContent = hideComments(content);
          const html = wrapTables(md.render(cleanedContent));

          if (containerRef.current) {
            morphdom(containerRef.current, `<div>${html}</div>`, { childrenOnly: true });
          }
        }
      } catch (error) {
        console.error("Error fetching markdown stream:", error);
        if (retry) await fetchStream(false);
      }
    };

    void fetchStream();
  }, [markdownUrl]);

  return <div ref={containerRef} />;
}

function wrapTables(html: string): string {
  return html.replace(/<table>/g, '<div class="table-wrapper"><table>').replace(/<\/table>/g, "</table></div>");
}

function hideComments(markdown: string): string {
  return markdown.replace(/<!--[\s\S]*?-->/g, "");
}
