import { tool } from "ai";
import { Innertube, Parser, UniversalCache } from "youtubei.js";
import z from "zod";

import { env } from "../env.ts";

Parser.setParserErrorHandler(() => {});

export const youtubeTranscript = z.object({
  url: z.url().describe("The URL of the YouTube video to fetch transcript from"),
});

export type YoutubeTranscript = z.infer<typeof youtubeTranscript>;

type Handler = (content: Content) => Promise<void>;
type Content = {
  url: string;
  transcript: string;
  title?: string;
  author?: string;
  channel?: string;
  date?: string;
  relative_date?: string;
};

const innertube = {
  instance: null as Innertube | null,
  async get(): Promise<Innertube> {
    if (!this.instance)
      this.instance = await Innertube.create({
        retrieve_player: false,
        generate_session_locally: true,
        cache: new UniversalCache(true, "./.cache/youtube"),
        cookie: env.youtubeCookie,
      });
    return this.instance;
  },
};

export const fetchYoutubeTranscript = (handler: Handler) =>
  tool({
    description: `Fetch and polish the transcript of a YouTube video. Returns a clean, readable transcript. Use this when you need to retrieve information from a YouTube video.`,
    inputSchema: youtubeTranscript,
    execute: async ({ url }) => {
      try {
        const { transcript, title, author, channel, date, relative_date } = await fetchAndPolishTranscript(url);
        await handler({ url, transcript, title, author, channel, date, relative_date });
        return { success: true, title, transcript, author, channel, date, relative_date } as const;
      } catch (err) {
        return { success: false, error: String(err) } as const;
      }
    },
  });

/**
 * Fetches and polishes the transcript of a YouTube video.
 */
async function fetchAndPolishTranscript(url: string): Promise<Content> {
  const youtube = await innertube.get();

  // Extract video ID from URL
  const videoId = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11}).*/)?.[1];
  if (!videoId) {
    throw new Error("Invalid YouTube URL");
  }

  try {
    const info = await youtube.getInfo(videoId);
    const transcriptData = await info.getTranscript();
    const segments = transcriptData?.transcript?.content?.body?.initial_segments;

    if (!segments || !Array.isArray(segments)) {
      throw new Error("No transcript segments found");
    }

    const transcript = segments.map((segment: any) => segment.snippet.text).join(" ");

    return {
      url,
      transcript,
      title: info.basic_info.title,
      author: info.basic_info.author,
      channel: info.basic_info.channel?.name,
      date: info.primary_info?.published?.toString(),
      relative_date: info.primary_info?.relative_date?.toString(),
    };
  } catch (e) {
    throw new Error(`Failed to get transcript: ${e instanceof Error ? e.message : String(e)}`);
  }
}
