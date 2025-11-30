import markdownIt from "markdown-it-ts";
import morphdom from "morphdom";
import { useEffect, useRef } from "react";

const md = markdownIt();

export function MarkdownStream({ responseId }: { responseId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let content = "";

    const fetchStream = async (retry = true): Promise<void> => {
      try {
        const response = await fetch(`/responses/md/${responseId}`);
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
  }, [responseId]);

  return <div ref={containerRef} />;
}

const wrapTables = (html: string): string =>
  html.replace(/<table>/g, '<div class="table-wrapper"><table>').replace(/<\/table>/g, "</table></div>");

const hideComments = (markdown: string): string => markdown.replace(/<!--[\s\S]*?-->/g, "");
