import { tool } from "ai";
import z from "zod";
import { env } from "../env.ts";

const googleSearchSchema = z.object({
  query: z.string().describe("The search query to send to Google"),
  numResults: z.number().min(1).max(10).default(5).describe("Number of search results to return (1-10)"),
});

const googleSearchOutputSchema = z.object({
  results: z.array(
    z.object({
      title: z.string().describe("The title of the search result"),
      link: z.url().describe("The URL of the search result"),
      snippet: z.string().describe("A brief snippet or description of the result"),
    })
  ),
  searchInformation: z.object({
    totalResults: z.string().describe("Total number of results found"),
    searchTime: z.number().describe("Time taken to perform the search in seconds"),
  }),
});

type GoogleSearchResult = z.infer<typeof googleSearchOutputSchema>;
type Handler = (result: GoogleSearchResult & { query: string }) => Promise<void>;

interface GoogleApiItem {
  title?: string;
  link?: string;
  snippet?: string;
}

/**
 * Creates a tool that performs Google searches using the Custom Search JSON API.
 */
export const googleSearch = (handler: Handler | null) =>
  tool({
    description: `Search Google and retrieve relevant results. Use this when you need to find current information, research topics, or discover web resources.`,
    inputSchema: googleSearchSchema,
    outputSchema: googleSearchOutputSchema,
    execute: async ({ query, numResults }) => {
      const result = await performGoogleSearch(query, numResults);
      await handler?.({ ...result, query });
      return result;
    },
  });

/** Performs a Google Custom Search API request. */
async function performGoogleSearch(query: string, numResults: number): Promise<GoogleSearchResult> {
  const apiKey = env.googleSearchApiKey;
  const cseId = env.googleCseId;

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cseId);
  url.searchParams.set("q", query);
  url.searchParams.set("num", numResults.toString());

  const response = await fetch(url.toString());

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Search API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();

  if (!data.items || data.items.length === 0) {
    return {
      results: [],
      searchInformation: {
        totalResults: data.searchInformation?.totalResults || "0",
        searchTime: data.searchInformation?.searchTime || 0,
      },
    };
  }

  return {
    results: data.items.map((item: GoogleApiItem) => ({
      title: item.title || "",
      link: item.link || "",
      snippet: item.snippet || "",
    })),
    searchInformation: {
      totalResults: data.searchInformation?.totalResults || "0",
      searchTime: data.searchInformation?.searchTime || 0,
    },
  };
}
