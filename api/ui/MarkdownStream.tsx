import markdownIt from "markdown-it-ts";
import { useEffect, useState } from "react";

const md = markdownIt({ stream: true });

export function MarkdownStream({ responseId }: { responseId: string }) {
  const [html, setHtml] = useState("");

  useEffect(() => {
    let markdown = "";

    const fetchStream = async (retry = true): Promise<void> => {
      try {
        const response = await fetch(`/responses/md/${responseId}`);
        if (!response.ok || !response.body) throw new Error("Failed to fetch");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          markdown += decoder.decode(value, { stream: true });
          setHtml(md.render(markdown));
        }
      } catch (error) {
        console.error("Error fetching markdown stream:", error);
        if (retry) await fetchStream(false);
      }
    };

    void fetchStream();
  }, [responseId]);

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
