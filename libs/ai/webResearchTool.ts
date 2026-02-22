import { tool } from "ai";
import z from "zod";
import { env } from "../env.ts";

const BASE_URL = "https://api.search.brave.com/res/v1/llm/context";

type ContextThresholdMode = "strict" | "balanced" | "lenient" | "disabled";

const DEPTH_CONFIG = {
  quick: {
    count: 20,
    maximumNumberOfTokens: 2048,
    maximumNumberOfUrls: 5,
    maximumNumberOfSnippets: 15,
    maximumNumberOfTokensPerUrl: 512,
    maximumNumberOfSnippetsPerUrl: 5,
    contextThresholdMode: "strict" satisfies ContextThresholdMode,
  },
  standard: {
    count: 30,
    maximumNumberOfTokens: 8192,
    maximumNumberOfUrls: 20,
    maximumNumberOfSnippets: 50,
    maximumNumberOfTokensPerUrl: 1024,
    maximumNumberOfSnippetsPerUrl: 8,
    contextThresholdMode: "balanced" satisfies ContextThresholdMode,
  },
  deep: {
    count: 50,
    maximumNumberOfTokens: 32768,
    maximumNumberOfUrls: 40,
    maximumNumberOfSnippets: 100,
    maximumNumberOfTokensPerUrl: 2048,
    maximumNumberOfSnippetsPerUrl: 10,
    contextThresholdMode: "lenient" satisfies ContextThresholdMode,
  },
} as const;

const TIMEOUT_MS = 30_000;

const RESEARCH_DEPTH_GUIDANCE = `Adjust by task complexity. Smaller budgets = faster responses.
- quick: Simple factual (count 5, max 2048 tokens). Example: "What year was Python created?"
- standard: Standard queries (count 20, max 8192 tokens). Example: "Best practices for React hooks"
- deep: Complex research (count 50, max 32768 tokens). Example: "Compare AI frameworks for production"`;

const researchDepthSchema = z.enum(["quick", "standard", "deep"]);

const webResearchSchema = z.object({
  query: z.string().min(1).max(400).describe("The search query (1–400 characters)"),
  researchDepth: researchDepthSchema.default("standard").describe(RESEARCH_DEPTH_GUIDANCE),
});

const webResearchOutputSchema = z.object({
  results: z.array(
    z.object({
      title: z.string(),
      link: z.string().url(),
      snippets: z.array(z.string()),
    }),
  ),
  sources: z.record(
    z.string(),
    z.object({
      title: z.string(),
      hostname: z.string(),
      age: z.array(z.string()).nullable(),
    }),
  ),
});

type WebResearchResult = z.infer<typeof webResearchOutputSchema>;
type ResearchDepth = z.infer<typeof researchDepthSchema>;
type Handler = (result: WebResearchResult & { query: string }) => Promise<void>;

interface BraveGroundingItem {
  url: string;
  title: string;
  snippets: string[];
}

interface BraveSource {
  title: string;
  hostname: string;
  age: string[] | null;
}

interface BraveContextResponse {
  grounding?: {
    generic?: BraveGroundingItem[];
  };
  sources?: Record<string, BraveSource>;
}

/**
 * Creates a tool that performs web research using Brave's LLM Context API.
 */
export const webResearch = (handler: Handler | null) =>
  tool({
    description:
      "Search the web to find current information, explore topics, or discover resources. Supports configurable research depth for quick lookups or thorough investigation.",
    inputSchema: webResearchSchema,
    outputSchema: webResearchOutputSchema,
    execute: async ({ query, researchDepth }) => {
      const result = await performBraveSearch(query, researchDepth);
      await handler?.({ ...result, query });
      return result;
    },
  });

async function performBraveSearch(query: string, depth: ResearchDepth): Promise<WebResearchResult> {
  const config = DEPTH_CONFIG[depth];

  const url = new URL(BASE_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("count", config.count.toString());
  url.searchParams.set("maximum_number_of_tokens", config.maximumNumberOfTokens.toString());
  url.searchParams.set("maximum_number_of_urls", config.maximumNumberOfUrls.toString());
  url.searchParams.set("maximum_number_of_snippets", config.maximumNumberOfSnippets.toString());
  url.searchParams.set("maximum_number_of_tokens_per_url", config.maximumNumberOfTokensPerUrl.toString());
  url.searchParams.set("maximum_number_of_snippets_per_url", config.maximumNumberOfSnippetsPerUrl.toString());
  url.searchParams.set("context_threshold_mode", config.contextThresholdMode);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": env.braveSearchApiKey,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Brave Search API error: ${response.status} ${response.statusText} - ${body}`);
    }

    const data: BraveContextResponse = await response.json();
    const items = data.grounding?.generic ?? [];

    return {
      results: items.map((item) => ({
        title: item.title,
        link: item.url,
        snippets: item.snippets,
      })),
      sources: data.sources ?? {},
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Brave Search timed out after ${TIMEOUT_MS / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
