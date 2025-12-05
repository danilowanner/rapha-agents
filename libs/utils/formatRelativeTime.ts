/**
 * Formats relative time from a timestamp (e.g., "5m ago", "2h ago", "3d ago").
 */
export const formatRelativeTime = (timestamp: Date, now: Date = new Date()): string => {
  const diffMs = now.getTime() - timestamp.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};
