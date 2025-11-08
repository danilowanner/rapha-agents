/**
 * Shortens text to a maximum length, adding an ellipsis if truncated.
 */
export function shorten(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const sliceLen = maxLength - 2;
  return text.slice(0, sliceLen).trimEnd() + "…";
}
