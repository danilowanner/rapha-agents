import { createFileRoute } from "@tanstack/react-router";

import { MarkdownViewer } from "../../ui/MarkdownViewer.tsx";
import { getDocView } from "../../server/docs.ts";

export const Route = createFileRoute("/docs/$id")({
  loader: ({ params }) => getDocView({ data: { shortId: params.id } }),
  head: ({ loaderData }) => ({ meta: [{ title: loaderData?.title ?? "Rapha Studio" }] }),
  component: DocView,
});

function DocView() {
  const doc = Route.useLoaderData();
  return <MarkdownViewer markdownUrl={`/docs/md/${doc.shortId}`} />;
}
