import { MarkdownStream } from "../../ui/MarkdownStream.tsx";
import "./MarkdownViewer.css";

type Props = {
  markdownUrl: string;
};

export function MarkdownViewer({ markdownUrl }: Props) {
  return (
    <div className="document markdown-content">
      <MarkdownStream markdownUrl={markdownUrl} />
    </div>
  );
}
