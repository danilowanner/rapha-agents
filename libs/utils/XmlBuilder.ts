/**
 * Simple XML builder for readable XML generation with automatic escaping.
 */
export class XmlBuilder {
  private tag: string;
  private content?: string;
  private attrs: Record<string, string>;
  private children: XmlBuilder[] = [];

  constructor(tag: string, content?: string, attrs: Record<string, string> = {}) {
    this.tag = tag;
    this.content = content;
    this.attrs = attrs;
  }

  child(tag: string, content?: string, attrs: Record<string, string> = {}): XmlBuilder {
    const child = new XmlBuilder(tag, content, attrs);
    this.children.push(child);
    return child;
  }

  build(indent = 0): string {
    const pad = "  ".repeat(indent);
    const attrStr = Object.entries(this.attrs)
      .map(([k, v]) => ` ${k}="${escapeXml(v)}"`)
      .join("");

    if (this.content !== undefined && this.children.length === 0) {
      return `${pad}<${this.tag}${attrStr}>${escapeXml(this.content)}</${this.tag}>`;
    }

    const childrenStr = this.children.map((c) => c.build(indent + 1)).join("\n");
    return `${pad}<${this.tag}${attrStr}>\n${childrenStr}\n${pad}</${this.tag}>`;
  }
}

const escapeXml = (text: string): string => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};
