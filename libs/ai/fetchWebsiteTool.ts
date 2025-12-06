import { Readability } from "@mozilla/readability";
import { tool } from "ai";
import { JSDOM, VirtualConsole } from "jsdom";
import TurndownService from "turndown";
import z from "zod";

const STYLE_TAG_REGEX = /<style[^>]*>[\s\S]*?<\/style>/gi;

const websiteContentSchema = z.object({
  url: z.url().describe("The URL of the website to fetch content from. Supports shortened URLs and redirects."),
});

type WebsiteContent = { url: string; markdown: string; title?: string; excerpt?: string };
type Handler = (content: WebsiteContent) => Promise<void>;

const virtualConsole = new VirtualConsole();
virtualConsole.on("error", () => {});

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});
turndown.remove(["script", "style", "nav", "header", "footer"]);

/**
 * Creates a tool that fetches and extracts website content as Markdown.
 */
export const fetchWebsite = (handler: Handler) =>
  tool({
    description: `Fetch and extract content from a website URL. Returns clean Markdown-formatted content. Use this when you need to retrieve information from web pages.`,
    inputSchema: websiteContentSchema,
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

async function fetchWebsiteContent(url: string): Promise<{ markdown: string; title?: string; excerpt?: string }> {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
  });

  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);

  const html = await response.text();
  const cleanHtml = html.replace(STYLE_TAG_REGEX, "");
  const dom = new JSDOM(cleanHtml, { url, virtualConsole });
  const article = new Readability(dom.window.document).parse();

  if (!article) throw new Error("Failed to extract article content from the webpage");

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
