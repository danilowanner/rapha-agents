import type { SnapshotNode } from "../types/SnapshotNode.ts";

export function findElement(snapshot: SnapshotNode, regex: RegExp): string[] {
  if (snapshot == null) return [];
  if (typeof snapshot === "string") {
    return regex.test(snapshot) ? [snapshot] : [];
  }
  if (Array.isArray(snapshot)) return snapshot.flatMap((s) => findElement(s, regex));
  if (typeof snapshot === "object") {
    // Allow searching in keys and values
    return Object.entries(snapshot).flatMap((v) => findElement(v, regex));
  }
  return [];
}
