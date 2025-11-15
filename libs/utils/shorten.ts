/**
 * Shortens text to a maximum display width, adding an ellipsis if truncated.
 * Accounts for Chinese characters taking up 2 columns of space.
 */
export function shorten(text: string, maxLength: number): string {
  const ellipsisWidth = 1;
  if (getDisplayWidth(text) <= maxLength) return text;

  const index = Array.from(text).reduce(
    (acc, char) => {
      if (acc.width + getCharWidth(char) + ellipsisWidth > maxLength) {
        return acc;
      }
      return { index: acc.index + 1, width: acc.width + getCharWidth(char) };
    },
    { index: 0, width: 0 }
  ).index;

  return text.slice(0, index).trimEnd() + "…";
}

/**
 * Calculate the total display width of a string.
 */
function getDisplayWidth(text: string): number {
  return Array.from(text).reduce((width, char) => width + getCharWidth(char), 0);
}

/**
 * Calculate the display width of a character.
 * CJK characters and other wide characters count as 2, others count as 1.
 */
function getCharWidth(char: string): number {
  const code = char.codePointAt(0);
  if (!code) return 1;

  // CJK Unified Ideographs and related ranges
  if (
    (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
    (code >= 0x3400 && code <= 0x4dbf) || // CJK Extension A
    (code >= 0x20000 && code <= 0x2a6df) || // CJK Extension B
    (code >= 0x2a700 && code <= 0x2b73f) || // CJK Extension C
    (code >= 0x2b740 && code <= 0x2b81f) || // CJK Extension D
    (code >= 0x2b820 && code <= 0x2ceaf) || // CJK Extension E
    (code >= 0xf900 && code <= 0xfaff) || // CJK Compatibility Ideographs
    (code >= 0x2f800 && code <= 0x2fa1f) || // CJK Compatibility Ideographs Supplement
    (code >= 0x3000 && code <= 0x303f) || // CJK Symbols and Punctuation
    (code >= 0xff00 && code <= 0xffef) || // Halfwidth and Fullwidth Forms
    (code >= 0xac00 && code <= 0xd7af) // Hangul Syllables
  ) {
    return 2;
  }

  return 1;
}
