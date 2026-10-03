/**
 * Reads the text of the first element with this tag.
 */
export function elementText(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}\\b[^>]*>([^<]*)</${tag}>`, "i"));
  const text = match?.[1]?.trim();
  return text ? decodeXml(text) : undefined;
}

/**
 * Reads attributes from each opening tag with this name.
 */
export function elements(xml: string, tag: string): Record<string, string>[] {
  return [...xml.matchAll(new RegExp(`<${tag}\\b([^>]*)\\/?>`, "gi"))].map((match) => attributes(match[1] ?? ""));
}

function attributes(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of source.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    attrs[match[1] ?? ""] = decodeXml(match[2] ?? match[3] ?? "");
  }
  return attrs;
}

function decodeXml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}
