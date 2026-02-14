/**
 * Formats a date as "DD MMM YYYY, HH:MM HKT" in Hong Kong timezone (e.g., "02 Dec 2025, 14:32 HKT").
 */
export const formatDateTime = (date: Date = new Date()): string => {
  const day = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Hong_Kong",
  });
  const time = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Hong_Kong",
  });
  return `${day}, ${time} HKT`;
};
