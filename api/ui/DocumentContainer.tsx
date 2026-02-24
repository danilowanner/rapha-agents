export const rootElementId = "document-root";

type DocumentPayload = {
  markdownUrl: string;
};

type Props = {
  dataDocument: DocumentPayload;
};

export const DocumentContainer = ({ dataDocument }: Props) => {
  return (
    <div className="document markdown-content">
      <div id={rootElementId} data-document={JSON.stringify(dataDocument)} />
    </div>
  );
};
