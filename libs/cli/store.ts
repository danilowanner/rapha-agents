import { atom, createStore } from "jotai";
import type { LogEntry } from "./types/LogEntry.js";

const MAX_BUFFER = 1000;

let nextId = 1;

export const logEntriesAtom = atom<LogEntry[]>([]);

export const store = createStore();

/**
 * addLogEntry appends a new log entry to the logEntriesAtom, trimming buffer size if needed.
 */
export const addLogEntry = (entry: Omit<LogEntry, "id" | "timestamp">) => {
  store.set(logEntriesAtom, (prev) => {
    const next: LogEntry[] = [...prev, { id: nextId++, timestamp: Date.now(), ...entry }];
    if (next.length > MAX_BUFFER) next.splice(0, next.length - MAX_BUFFER);
    return next;
  });
};
