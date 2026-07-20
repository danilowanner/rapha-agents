/** Encodes a string stream as response bytes and emits a final readable error. */
export const encodeTextStream = (stream: ReadableStream<string>): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  const reader = stream.getReader();
  let cancelled = false;
  return new ReadableStream({
    async start(controller) {
      try {
        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(encoder.encode(value));
        }
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("[RESPONSE STREAM]", message);
        controller.enqueue(encoder.encode(`\n\n⚠️ Error streaming markdown: ${message}\n\n`));
      } finally {
        if (!cancelled) controller.close();
      }
    },
    async cancel(reason) {
      cancelled = true;
      await reader.cancel(reason);
    },
  });
};

export const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
} as const;

/** Adds tool API CORS headers without changing response body or status. */
export function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([name, value]) => headers.set(name, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
