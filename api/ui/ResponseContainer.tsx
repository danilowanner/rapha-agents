export const rootElementId = "response-root";

type Props = {
  id?: string;
};

export const ResponseContainer = ({ id }: Props) => {
  return (
    <div className="response markdown-content">
      <div id={rootElementId} data-response-id={id} />
    </div>
  );
};
