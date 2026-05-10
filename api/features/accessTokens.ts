const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

interface TokenEntry {
  expiresAt: Date;
}

const tokens = new Map<string, TokenEntry>();

/** Issues a new access token valid for 24 hours (query param for /app and other gated routes). */
export function issueAccessToken(): { token: string; expiresAt: Date } {
  pruneExpiredTokens();
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  tokens.set(token, { expiresAt });
  return { token, expiresAt };
}

/** Returns true if the token exists and has not expired. */
export function isValidAccessToken(token: string): boolean {
  const entry = tokens.get(token);
  if (!entry) return false;
  if (entry.expiresAt < new Date()) {
    tokens.delete(token);
    return false;
  }
  return true;
}

const pruneExpiredTokens = (): void => {
  const now = new Date();
  tokens.forEach((entry, token) => {
    if (entry.expiresAt < now) tokens.delete(token);
  });
};
