export type AppPayload =
  | { view: "markdown"; title: string; markdownUrl: string }
  | { view: "dashboard"; title: string; userId?: string };

export const clientAppRootId = "app-root";

type Props = {
  payload: AppPayload;
};

export const ClientApp = ({ payload }: Props) => (
  <html lang="en">
    <head>
      <meta charSet="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{payload.title}</title>
      <script src="/assets/main.js" defer />
    </head>
    <body>
      <div id={clientAppRootId} data-payload={JSON.stringify(payload)} />
    </body>
  </html>
);
