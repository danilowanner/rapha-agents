import type { SnapshotNode } from "../types/SnapshotNode.ts";

interface ExtractOptions {
  joinWith?: string;
  includeRoles?: boolean;
}

/**
 * Extract plain text from a mixed website snapshot JSON into a single string.
 */
export function extractText(
  snapshot: SnapshotNode,
  { joinWith = "\n", includeRoles = false }: ExtractOptions = {}
): string {
  const chunks: string[] = [];
  function add(text?: string) {
    if (!text) return;
    const cleaned = String(text).trim();
    if (cleaned) chunks.push(cleaned);
  }
  function labelFromRoleString(s: string) {
    const m = s.match(/"([^"]+)"/);
    if (m) return m[1];
    return s
      .replace(/\[[^\]]*\]/g, "")
      .replace(/^\s*\w+\s*/, "")
      .trim();
  }
  function visit(node: SnapshotNode | undefined | null): void {
    if (node == null) return;
    if (typeof node === "string") {
      const textInQuotes = node.match(/"([^"]+)"/);
      if (textInQuotes) {
        add(textInQuotes[1]);
        return;
      }
      const stripped = node.replace(/\[[^\]]*\]/g, "").trim();
      if (/^\b(img|button|link|heading|list|listitem|group|paragraph|text)\b/i.test(stripped)) {
        if (includeRoles) add(stripped);
        return;
      }
      if (stripped) add(stripped);
      return;
    }
    if (Array.isArray(node)) {
      for (const n of node) visit(n);
      return;
    }
    const entries = Object.entries(node as Record<string, SnapshotNode>);
    for (const [key, value] of entries) {
      if (key === "/url") continue;
      if (key === "text" && typeof value === "string") {
        add(value);
        continue;
      }
      if (/^paragraph\b/i.test(key) && typeof value === "string") {
        add(value);
        continue;
      }
      if (/^(heading|link|button|img|group|list|listitem)\b/i.test(key)) {
        const label = labelFromRoleString(key);
        if (label) add(label);
        visit(value);
        continue;
      }
      visit(value);
    }
  }
  visit(snapshot);
  const text = chunks.map((c) => c.replace(/\s+/g, " ").trim()).filter(Boolean);
  const deduped: string[] = [];
  for (const t of text) {
    if (deduped[deduped.length - 1] !== t) deduped.push(t);
  }
  return deduped.join(joinWith);
}
