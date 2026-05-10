import type { AppPayload } from "../ui/ClientApp.tsx";
import { Dashboard } from "./views/Dashboard.tsx";
import { MarkdownViewer } from "./views/MarkdownViewer.tsx";

type Props = {
  payload: AppPayload;
};

export function App({ payload }: Props) {
  switch (payload.view) {
    case "markdown":
      return <MarkdownViewer markdownUrl={payload.markdownUrl} />;
    case "dashboard":
      return <Dashboard userId={payload.userId} />;
    default:
      payload satisfies never;
      throw new Error("Unknown view");
  }
}
