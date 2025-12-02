import { Readability } from "@mozilla/readability";
import { tool } from "ai";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import z from "zod";

export const websiteContent = z.object({
  url: z.url().describe("The URL of the website to fetch content from. Supports shortened URLs and redirects."),
});

export type WebsiteContent = z.infer<typeof websiteContent>;

type Handler = (content: { url: string; markdown: string; title?: string; excerpt?: string }) => Promise<void>;

export const fetchWebsite = (handler: Handler) =>
  tool({
    description: `Fetch and extract content from a website URL. Returns clean Markdown-formatted content. Use this when you need to retrieve information from web pages.`,
    inputSchema: websiteContent,
    execute: async ({ url }) => {
      try {
        const { markdown, title, excerpt } = await fetchWebsiteContent(url);
        await handler({ url, markdown, title, excerpt });
        return { success: true, title, excerpt, markdown } as const;
      } catch (err) {
        return { success: false, error: String(err) } as const;
      }
    },
  });

/**
 * Fetches and extracts content from a website in Markdown format.
 */
async function fetchWebsiteContent(url: string): Promise<{ markdown: string; title?: string; excerpt?: string }> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article) {
    throw new Error("Failed to extract article content from the webpage");
  }

  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });

  turndown.remove(["script", "style", "nav", "header", "footer"]);

  const markdown = turndown
    .turndown(article.content || "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    markdown,
    title: article.title || undefined,
    excerpt: article.excerpt || undefined,
  };
}
