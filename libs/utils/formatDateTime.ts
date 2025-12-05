/**
 * Formats a date as "DD MMM YYYY, HH:MM" string (e.g., "02 Dec 2025, 14:32").
 */
export const formatDateTime = (date: Date = new Date()): string => {
  const day = date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${day}, ${time}`;
};
