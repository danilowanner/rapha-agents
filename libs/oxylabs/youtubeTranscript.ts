import { env } from "../env.ts";
import type {
  FetchOptions,
  MetadataRequest,
  MetadataResponse,
  OxylabsRequest,
  OxylabsResponse,
  OxylabsValidatedResult,
  SubtitleContent,
  SubtitleEvent,
  TranscriptAttempt,
  TranscriptOrigin,
  TranscriptResult,
  TranscriptSegment,
  TranscriptSource,
  VideoMetadata,
} from "./types.ts";

const OXYLABS_API_URL = "https://realtime.oxylabs.io/v1/queries";
const LANGUAGE_CODE = "en";

const TRANSCRIPT_ATTEMPTS: readonly TranscriptAttempt[] = [
  { source: "youtube_transcript", origin: "uploader_provided" },
  { source: "youtube_subtitles", origin: "uploader_provided" },
  { source: "youtube_transcript", origin: "auto_generated" },
  { source: "youtube_subtitles", origin: "auto_generated" },
] as const;

/**
 * Fetches YouTube transcript via Oxylabs API with metadata-informed strategy selection.
 */
export const fetchYoutubeTranscript = async (videoId: string, url: string): Promise<TranscriptResult> => {
  const metadata = await fetchVideoMetadata(videoId);
  const { title, uploader } = metadata;
  if (!metadata.is_transcript_available)
    throw new Error(`No transcripts available for the video ${videoId} (${title})`);

  const attempts = selectTranscriptAttempts(metadata);
  const transcript = await fetchTranscriptText(videoId, attempts);

  return { url, transcript, title, uploader };
};

async function fetchTranscriptText(videoId: string, attempts: readonly TranscriptAttempt[]): Promise<string> {
  for (const { source, origin } of attempts) {
    try {
      return await fetchWithStrategy(videoId, source, origin);
    } catch (error) {
      console.warn(`Oxylabs ${source} (${origin}) failed:`, error);
    }
  }

  throw new Error("All Oxylabs transcript fetch attempts failed");
}

async function fetchWithStrategy(videoId: string, source: TranscriptSource, origin: TranscriptOrigin): Promise<string> {
  const response = await makeOxylabsRequest({ videoId, source, origin });
  const data = await parseOxylabsResponse(response);
  return extractTranscript(data.content, source);
}

async function makeOxylabsRequest(options: FetchOptions): Promise<Response> {
  const { videoId, source, origin } = options;
  const originKey = source === "youtube_transcript" ? "transcript_origin" : "subtitle_origin";

  const requestBody: OxylabsRequest = {
    source,
    query: videoId,
    context: [
      { key: "language_code", value: LANGUAGE_CODE },
      { key: originKey, value: origin },
    ],
  };

  const oxylabsUsername = env.oxylabsUsername;
  const oxylabsPassword = env.oxylabsPassword;
  if (!oxylabsUsername || !oxylabsPassword) throw new Error("Oxylabs credentials not configured");

  const response = await fetch(OXYLABS_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: createBasicAuthHeader(oxylabsUsername, oxylabsPassword),
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Oxylabs API error: ${response.status} ${response.statusText}`);
  }

  return response;
}

async function parseOxylabsResponse(response: Response): Promise<OxylabsValidatedResult> {
  const data: OxylabsResponse = await response.json();
  const result = data.results?.[0];

  if (!result) throw new Error("No results from Oxylabs");

  const statusCode = result.status_code;
  const content = result.content;

  if (statusCode !== 200 || !content) {
    throw new Error(`Oxylabs failed: status_code=${statusCode}, job_status=${data.job?.status}`);
  }

  return { status_code: statusCode, content };
}

function extractTranscript(content: string | TranscriptSegment[] | SubtitleContent, source: TranscriptSource): string {
  if (typeof content === "string") return extractFromString(content);
  if (Array.isArray(content)) return extractFromSegments(content);
  return extractFromSubtitleContent(content);
}

function extractFromString(content: string): string {
  const transcript = content.trim();
  if (!transcript) throw new Error("Empty transcript from Oxylabs");
  return transcript;
}

function extractFromSegments(segments: TranscriptSegment[]): string {
  if (segments.length === 0) throw new Error("Empty content array from Oxylabs");

  const transcript = segments
    .flatMap((segment) => segment.transcriptSegmentRenderer?.snippet.runs ?? [])
    .map((run) => run.text)
    .join(" ")
    .trim();

  if (!transcript) throw new Error("Empty transcript from Oxylabs");
  return transcript;
}

function extractFromSubtitleContent(content: SubtitleContent): string {
  const events = findEvents(content);
  if (!events) throw new Error("Unexpected subtitle content structure from Oxylabs");

  const textParts = events
    .flatMap((event) => event.segs ?? [])
    .map((seg) => seg.utf8?.trim())
    .filter((text): text is string => Boolean(text));

  const transcript = textParts.join(" ").trim();
  if (!transcript) throw new Error("Empty transcript from Oxylabs");
  return transcript;
}

function findEvents(content: SubtitleContent): SubtitleEvent[] | undefined {
  return content.auto_generated?.en?.events ?? content.uploader_provided?.en?.events;
}

function selectTranscriptAttempts(metadata: VideoMetadata): readonly TranscriptAttempt[] {
  const hasUserSubtitles = metadata.user_subtitle_languages?.includes(LANGUAGE_CODE);
  const hasUserTranscript = metadata.user_transcript_languages?.includes(LANGUAGE_CODE);
  const hasGeneratedTranscript = metadata.generated_transcript_languages?.includes(LANGUAGE_CODE);
  const hasGeneratedSubtitles = metadata.generated_subtitle_languages?.includes(LANGUAGE_CODE);

  const attempts: TranscriptAttempt[] = [];

  if (hasUserTranscript) attempts.push({ source: "youtube_transcript", origin: "uploader_provided" });
  if (hasUserSubtitles) attempts.push({ source: "youtube_subtitles", origin: "uploader_provided" });
  if (hasGeneratedTranscript) attempts.push({ source: "youtube_transcript", origin: "auto_generated" });
  if (hasGeneratedSubtitles) attempts.push({ source: "youtube_subtitles", origin: "auto_generated" });

  if (attempts.length === 0) return TRANSCRIPT_ATTEMPTS;

  return attempts;
}

async function fetchVideoMetadata(videoId: string): Promise<VideoMetadata> {
  const requestBody: MetadataRequest = {
    source: "youtube_metadata",
    query: videoId,
    parse: true,
  };

  const oxylabsUsername = env.oxylabsUsername;
  const oxylabsPassword = env.oxylabsPassword;
  if (!oxylabsUsername || !oxylabsPassword) throw new Error("Oxylabs credentials not configured");

  const response = await fetch(OXYLABS_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: createBasicAuthHeader(oxylabsUsername, oxylabsPassword),
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) throw new Error(`Oxylabs API error: ${response.status} ${response.statusText}`);

  const data: MetadataResponse = await response.json();
  const metadata = data.results?.[0]?.content?.results;
  if (!metadata) throw new Error("Missing metadata from Oxylabs response");
  return metadata;
}

function createBasicAuthHeader(username: string, password: string): string {
  const credentials = Buffer.from(`${username}:${password}`).toString("base64");
  return `Basic ${credentials}`;
}
