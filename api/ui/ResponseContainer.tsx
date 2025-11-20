export const rootElementId = "response-root";
export const contentPlaceholder = "{CONTENT_PLACEHOLDER}";

export const ResponseContainer = () => {
  return (
    <>
      <div className="response markdown-content">
        <div id={rootElementId} />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.Rapha.init()`,
          }}
        />
        {contentPlaceholder}
      </div>
    </>
  );
};
