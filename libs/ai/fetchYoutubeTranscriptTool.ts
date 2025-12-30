import { tool } from "ai";
import z from "zod";

import { fetchYoutubeTranscript as fetchViaOxylabs } from "../oxylabs/youtubeTranscript.ts";

const youtubeTranscript = z.object({
  url: z.url().describe("The URL of the YouTube video to fetch transcript from"),
});

const youtubeTranscriptOutput = z.object({
  title: z.string().optional().describe("The title of the YouTube video"),
  transcript: z.string().describe("The full transcript text of the video"),
});

export type YoutubeTranscript = z.infer<typeof youtubeTranscript>;

type Handler = (content: Content) => Promise<void>;
type Content = {
  url: string;
  transcript: string;
  title?: string;
};

/**
 * Fetches YouTube transcript using YouTube's timedtext API.
 */
export const fetchYoutubeTranscript = (handler: Handler) =>
  tool({
    description: `Fetch transcript from a YouTube video.`,
    inputSchema: youtubeTranscript,
    outputSchema: youtubeTranscriptOutput,
    execute: async ({ url }) => {
      const { transcript, title } = await fetchTranscript(url);
      await handler({ url, transcript, title });
      return { title, transcript };
    },
  });

async function fetchTranscript(url: string): Promise<Content> {
  const videoId = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11}).*/)?.[1];
  if (!videoId) throw new Error("Invalid YouTube URL");

  return await fetchViaOxylabs(videoId, url);
}
