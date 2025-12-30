import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export type PoeModelId =
  | "GPT-5.2-Instant"
  | "GPT-5.2-Pro"
  | "GPT-5.2"
  | "Gemini-3-Flash"
  | "Gemini-3-Pro"
  | "Claude-Opus-4.5"
  | "Claude-Haiku-4.5"
  | "Claude-Sonnet-4.5"
  | "Grok-4"
  | "DeepSeek-R1";

type PoeOptions = {
  apiKey: string;
  webSearch?: boolean;
};

export function createPoeAdapter(options: PoeOptions) {
  return createOpenAICompatible<PoeModelId, string, string, string>({
    name: "poe",
    baseURL: "https://api.poe.com/v1",
    apiKey: options.apiKey,
    fetch: async (url, init) => {
      if (options.webSearch && init?.body) {
        const body = JSON.parse(init.body as string);
        body.web_search = true;
        return fetch(url, {
          ...init,
          body: JSON.stringify(body),
        });
      }
      return fetch(url, init);
    },
  }).chatModel;
}
