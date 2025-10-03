import type { LogLevel } from "./LogLevel.ts";

export interface LogEntry {
  id: number;
  timestamp: number;
  level: LogLevel;
  component: string;
  text: string;
  details?: string;
}
