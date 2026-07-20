import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { MarkdownViewer } from "../../ui/MarkdownViewer.tsx";
import { addResponse, createResponseId, hasResponse } from "../../features/responses/state.ts";
import { createTestResponse } from "../../test/utils/createTestResponse.ts";

const resolveResponseId = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(({ data: id }) => {
    if (id !== "test") {
      if (!hasResponse(id)) throw notFound();
      return id;
    }

    const testId = createResponseId();
    addResponse(testId, createTestResponse(), { userId: "test" });
    return testId;
  });

export const Route = createFileRoute("/responses/view/$id")({
  loader: ({ params }) => resolveResponseId({ data: params.id }),
  head: () => ({ meta: [{ title: "Rapha Studio API" }] }),
  component: ResponseView,
});

function ResponseView() {
  const responseId = Route.useLoaderData();
  return <MarkdownViewer markdownUrl={`/responses/md/${responseId}`} />;
}
