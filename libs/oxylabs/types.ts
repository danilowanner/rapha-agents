export type TranscriptSource = "youtube_transcript" | "youtube_subtitles";
export type TranscriptOrigin = "auto_generated" | "uploader_provided";

export type TranscriptSegment = {
  transcriptSegmentRenderer?: {
    startMs: string;
    endMs: string;
    snippet: {
      runs: Array<{
        text: string;
      }>;
    };
    startTimeText: {
      simpleText: string;
    };
    trackingParams: string;
    accessibility: {
      accessibilityData: {
        label: string;
      };
    };
    targetId: string;
  };
  transcriptSectionHeaderRenderer?: {
    startMs: string;
    endMs: string;
    accessibility: {
      accessibilityData: {
        label: string;
      };
    };
    trackingParams: string;
    enableTappableTranscriptHeader: boolean;
    sectionHeader: {
      sectionHeaderViewModel: {
        headline: {
          content: string;
        };
      };
    };
  };
};

export type SubtitleSegment = {
  utf8: string;
};

export type SubtitleEvent = {
  tStartMs: number;
  dDurationMs: number;
  segs?: SubtitleSegment[];
};

export type SubtitleLanguageContent = {
  wireMagic: string;
  pens: unknown[][];
  wsWinStyles: unknown[][];
  wpWinPositions: unknown[][];
  events: SubtitleEvent[];
};

export type SubtitleContent = {
  auto_generated?: {
    en?: SubtitleLanguageContent;
  };
  uploader_provided?: {
    en?: SubtitleLanguageContent;
  };
};

export type OxylabsRequestContext = {
  key: string;
  value: string;
};

export type OxylabsRequest = {
  source: TranscriptSource;
  query: string;
  context: OxylabsRequestContext[];
};

export type OxylabsResult = {
  status_code?: number;
  content?: string | TranscriptSegment[] | SubtitleContent;
};

export type OxylabsValidatedResult = {
  status_code: number;
  content: string | TranscriptSegment[] | SubtitleContent;
};

export type OxylabsResponse = {
  results?: OxylabsResult[];
  job?: {
    status?: string;
  };
};

export type FetchOptions = {
  videoId: string;
  source: TranscriptSource;
  origin: TranscriptOrigin;
};

export type TranscriptAttempt = {
  source: TranscriptSource;
  origin: TranscriptOrigin;
};

export type MetadataRequest = {
  source: "youtube_metadata";
  query: string;
  parse: boolean;
};

export type VideoMetadata = {
  title?: string;
  is_transcript_available?: boolean;
  user_subtitle_languages?: string[];
  user_transcript_languages?: string[];
  generated_subtitle_languages?: string[];
  generated_transcript_languages?: string[];
};

export type MetadataResponse = {
  results?: Array<{
    content?: {
      results?: VideoMetadata;
    };
  }>;
};

export type TranscriptResult = {
  url: string;
  transcript: string;
  title?: string;
};
