type Props = {
  children: React.ReactNode;
  title: string;
};

export const Document = ({ children, title }: Props) => (
  <html lang="en">
    <head>
      <meta charSet="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title}</title>
      <script src="/assets/main.js" defer />
    </head>
    <body>{children}</body>
  </html>
);
