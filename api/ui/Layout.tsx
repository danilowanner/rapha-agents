type Props = {
  children: React.ReactNode;
  title: string;
};

export const Layout = ({ children, title }: Props) => (
  <html lang="en">
    <head>
      <meta charSet="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title}</title>
      <script src="/assets/main.js" />
    </head>
    <body>{children}</body>
  </html>
);
