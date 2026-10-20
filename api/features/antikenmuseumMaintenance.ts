import { spawn } from "node:child_process";
import { tool } from "ai";
import z from "zod";

import { env } from "../../libs/env.ts";
import { getErrorMessage } from "../../libs/utils/getErrorMessage.ts";
import { isDefined } from "../../libs/utils/isDefined.ts";

const sshUser = "root";
const sshHost = "basilisk.antikenmuseumbasel.ch";
const sshTimeoutMs = 20_000;
const maxOutputBytes = 32 * 1024;
const httpUrl = "https://www.antikenmuseumbasel.ch";
const httpTimeoutMs = 10_000;
const contentCacheFileWarn = 10_000;
const contentCacheMibWarn = 50;
const contentCacheByteWarn = contentCacheMibWarn * 1024 * 1024;
const contentCacheDir = "/var/www/builds/live/Data/Temporary/Production/Cache/Data/TYPO3_TypoScript_Content";
const productionCacheDir = "/var/www/builds/live/Data/Temporary/Production/Cache";
const focusCacheNames = ["TYPO3_TypoScript_Content", "Flow_Mvc_Routing_Resolve", "Flow_Mvc_Routing_Route"] as const;

const checkSchema = z.enum([
  "snapshot",
  "mysql",
  "oom",
  "http",
  "cert",
  "logs_apache",
  "logs_flow",
  "logs_mysql",
  "cache_content",
  "cache_top",
]);

type AntikenmuseumMaintenanceCheck = z.infer<typeof checkSchema>;

type AntikenmuseumMaintenanceResult = {
  check: AntikenmuseumMaintenanceCheck;
  ok: boolean;
  summary: string;
  raw: string;
};

type SshCheck = Exclude<AntikenmuseumMaintenanceCheck, "http">;

type RemoteOutput = {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  killed: boolean;
  spawnError?: string;
};

type CappedBuffer = {
  append: (chunk: Buffer | string) => void;
  text: () => string;
  isTruncated: () => boolean;
};

type ContentCacheStats = {
  files: number;
  bytes: number;
};

type CacheUsage = {
  name: string;
  bytes: number;
  files: number;
};

type CacheTopStats = {
  totalBytes: number;
  totalFiles: number;
  focus: CacheUsage[];
  missingFocus: string[];
  rows: CacheUsage[];
  missingScopes: string[];
};

const cacheTopAwk = [
  '$1=="TOTAL" {next}',
  '$1=="files" {files[$2]=$3; next}',
  '$1=="size" {bytes[$2]=$3; next}',
  '$1=="missing" {print; next}',
  "END {",
  `nnames = split("${focusCacheNames.join(" ")}", names, " ")`,
  "for (i = 1; i <= nnames; i++) {",
  "name = names[i]",
  "found = 0",
  'for (key in bytes) { if (key == "Data/" name || key == "Code/" name) { printf "focus %d %d %s\\n", bytes[key], (key in files ? files[key] : 0), key; found = 1 } }',
  'for (key in files) { if (!(key in bytes) && (key == "Data/" name || key == "Code/" name)) { printf "focus 0 %d %s\\n", files[key], key; found = 1 } }',
  'if (!found) printf "focus missing %s\\n", name',
  "}",
  'for (key in bytes) printf "row %d %d %s\\n", bytes[key], (key in files ? files[key] : 0), key',
  'for (key in files) if (!(key in bytes)) printf "row 0 %d %s\\n", files[key], key',
  "}",
].join("\n");

const cacheContentCommand = `set -euo pipefail
export LC_ALL=C
dir=${contentCacheDir}
kind=$(stat -L -c %F "$dir") || exit 1
[ "$kind" = directory ]
files=$(find "$dir" -type f -printf '.' | wc -c) || exit 1
printf 'files %s\\n' "$((files + 0))"
du -s --block-size=1 "$dir"
`;

const cacheTopCommand = `set -euo pipefail
export LC_ALL=C
cache=${productionCacheDir}
kind=$(stat -L -c %F "$cache") || exit 1
[ "$kind" = directory ]
total_bytes=$(du -s --block-size=1 "$cache" | awk '{print $1}') || exit 1
counts=$(find "$cache" -type f -printf '%P\\n' | awk -F/ '{total++} NF>=2 {c[$1 "/" $2]++} END {printf "TOTAL %d\\n", total+0; for (k in c) printf "files %s %d\\n", k, c[k]}') || exit 1
sizes=$(for scope in Data Code; do if [ -d "$cache/$scope" ]; then find "$cache/$scope" -mindepth 1 -maxdepth 1 -type d -exec du -s --block-size=1 {} + | awk -v p="$cache/" '{n=$2; sub("^" p, "", n); printf "size %s %s\\n", n, $1}'; else printf 'missing %s\\n' "$scope"; fi; done) || exit 1
merged=$(printf '%s\\n%s\\n' "$counts" "$sizes" | awk '${cacheTopAwk}') || exit 1
total_files=$(printf '%s\\n' "$counts" | awk '$1=="TOTAL" {print $2; exit}') || exit 1
printf 'total %s %s\\n' "$total_bytes" "$total_files"
printf '%s\\n' "$merged" | awk '$1=="focus"'
printf '%s\\n' "$merged" | awk '$1=="row" {printf "%s %s %s\\n", $2, $3, $4}' | sort -nr
printf '%s\\n' "$merged" | awk '$1=="missing"'
`;

const sshCommands = {
  snapshot: "free -m; echo '---'; cat /proc/loadavg; echo '---'; df -h / /var",
  mysql: "systemctl is-active mysql; echo '---'; mysqladmin --protocol=socket ping",
  oom: "journalctl -k -n 50 --no-pager",
  cert: "certbot certificates",
  logs_apache: "tail -n 80 /var/log/apache2/error.log",
  logs_flow: "tail -n 80 /var/www/builds/live/Data/Logs/System.log",
  logs_mysql: "tail -n 80 /var/log/mysql/error.log",
  cache_content: cacheContentCommand,
  cache_top: cacheTopCommand,
} as const satisfies Record<SshCheck, string>;

const antikenmuseumMaintenanceDescription = [
  "Read-only checks for the Antikenmuseum server basilisk.antikenmuseumbasel.ch. One check per call. No restarts, deploys, cache flushes, or user admin.",
  "Do not request https://antikenmuseumbasel.ch. That apex is on Cyon, not this server.",
  "Flow logs can contain secrets. Do not repeat raw into chat unless asked.",
  "snapshot: memory, load average, and disk for / and /var.",
  "mysql: mysql active state and a socket ping.",
  "oom: last 50 kernel journal lines.",
  "http: fetch https://www.antikenmuseumbasel.ch. Returns status and elapsed milliseconds.",
  "cert: certbot certificates. Exit 0 does not mean the certificate is valid.",
  "logs_apache: last 80 lines of the Apache error log.",
  "logs_flow: last 80 lines of the live Flow System.log.",
  "logs_mysql: last 80 lines of the MySQL error log.",
  `cache_content: file count and allocated size of live ${contentCacheDir}. Read-only find, du, and stat. No flush or delete. ok is false above ${contentCacheFileWarn} files or ${contentCacheMibWarn} MiB allocated (save-slowness pattern).`,
  `cache_top: totals for live ${productionCacheDir}, then every Data/ and Code/ cache by allocated size and file count. Surfaces ${focusCacheNames.join(", ")}. Read-only find, du, and stat. No flush or delete.`,
].join("\n");

/**
 * Read-only Antikenmuseum checks. SSH commands come from the map, never from the request.
 */
export const antikenmuseumMaintenanceTool = tool({
  description: antikenmuseumMaintenanceDescription,
  inputSchema: z.object({ check: checkSchema }),
  outputSchema: z.object({
    check: checkSchema,
    ok: z.boolean(),
    summary: z.string(),
    raw: z.string(),
  }),
  execute: async ({ check }) => runAntikenmuseumMaintenance(check),
});

async function runAntikenmuseumMaintenance(
  check: AntikenmuseumMaintenanceCheck,
): Promise<AntikenmuseumMaintenanceResult> {
  if (check === "http") return fetchHomepage();
  return runSshCheck(check);
}

const fetchHomepage = async (): Promise<AntikenmuseumMaintenanceResult> => {
  const started = performance.now();
  try {
    const response = await fetch(httpUrl, { signal: AbortSignal.timeout(httpTimeoutMs) });
    const elapsedMs = elapsedSince(started);
    if (response.body) await response.body.cancel().catch(() => undefined);
    return {
      check: "http",
      ok: response.status < 400,
      summary: `http ${response.status} in ${elapsedMs}ms`,
      raw: `status ${response.status} in ${elapsedMs}ms`,
    };
  } catch (error) {
    const message = getErrorMessage(error);
    return {
      check: "http",
      ok: false,
      summary: `http failed in ${elapsedSince(started)}ms: ${message}`,
      raw: message,
    };
  }
};

const runSshCheck = async (check: SshCheck): Promise<AntikenmuseumMaintenanceResult> => {
  const keyPath = env.apiSshKeyPath;
  const knownHosts = env.apiSshKnownHosts;
  if (!keyPath || !knownHosts) {
    const missing = [
      keyPath ? undefined : "API_SSH_KEY_PATH",
      knownHosts ? undefined : "API_SSH_KNOWN_HOSTS",
    ].filter(isDefined);
    return { check, ok: false, summary: `${missing.join(" and ")} missing`, raw: "" };
  }

  const output = await runRemoteCommand(sshCommands[check], keyPath, knownHosts);
  const commandOk = output.code === 0;
  const raw = commandOk ? output.stdout : output.stderr || output.spawnError || "";
  const isTruncated = commandOk ? output.stdoutTruncated : output.stderrTruncated;
  if (commandOk && check === "cache_content") return contentCacheResult(raw, isTruncated);
  if (commandOk && check === "cache_top") return cacheTopResult(raw, isTruncated);
  const failure = output.killed
    ? "timed out"
    : output.spawnError
      ? `failed: ${output.spawnError}`
      : output.code === null
        ? `signal ${output.signal ?? "unknown"}`
        : `exit ${output.code}`;

  return { check, ok: commandOk, summary: sshSummary(check, commandOk, failure, raw, isTruncated), raw };
};

const sshSummary = (check: SshCheck, ok: boolean, failure: string, raw: string, isTruncated: boolean): string => {
  const flags = ["INVALID", "EXPIRED"].filter((flag) => raw.includes(flag));
  const status = flags.length === 0 ? (ok ? "ok" : failure) : ok ? flags.join(", ") : `${failure}; ${flags.join(", ")}`;
  return withTruncation(`${check} ${status}`, isTruncated);
};

const contentCacheResult = (raw: string, isTruncated: boolean): AntikenmuseumMaintenanceResult => {
  const stats = parseContentCache(raw);
  if (!stats) {
    return { check: "cache_content", ok: false, summary: withTruncation("cache_content unreadable", isTruncated), raw };
  }
  const reasons = [
    stats.files > contentCacheFileWarn ? `${contentCacheFileWarn} files` : undefined,
    stats.bytes > contentCacheByteWarn ? `${contentCacheMibWarn} MiB` : undefined,
  ].filter(isDefined);
  const status = reasons.length === 0 ? "" : "WARN ";
  const reason = reasons.length === 0 ? "" : `; above ${reasons.join(" and ")}`;
  const summary = `cache_content ${status}${fileCountLabel(stats.files)}, ${formatMib(stats.bytes)} allocated${reason}`;
  return { check: "cache_content", ok: reasons.length === 0, summary: withTruncation(summary, isTruncated), raw };
};

const cacheTopResult = (raw: string, isTruncated: boolean): AntikenmuseumMaintenanceResult => {
  const stats = parseCacheTop(raw, isTruncated);
  if (!stats) {
    return { check: "cache_top", ok: false, summary: withTruncation("cache_top unreadable", isTruncated), raw };
  }
  const largest = stats.rows.filter((row) => !stats.focus.some((item) => item.name === row.name)).slice(0, 3);
  const mentioned = new Set([...stats.focus.map((row) => row.name), ...largest.map((row) => row.name)]);
  const mostFiles = stats.rows.reduce<CacheUsage | undefined>(
    (best, row) => (!best || row.files > best.files ? row : best),
    undefined,
  );
  const parts = [
    `total ${formatMib(stats.totalBytes)}, ${fileCountLabel(stats.totalFiles)}`,
    ...stats.focus.map(usageLabel),
    ...stats.missingFocus.map((name) => `${name} missing`),
    ...stats.missingScopes.map((scope) => `${scope} missing`),
    ...largest.map(usageLabel),
    mostFiles && !mentioned.has(mostFiles.name) ? `most files ${usageLabel(mostFiles)}` : undefined,
  ].filter(isDefined);
  return { check: "cache_top", ok: true, summary: withTruncation(`cache_top ${parts.join("; ")}`, isTruncated), raw };
};

const parseContentCache = (raw: string): ContentCacheStats | undefined => {
  const lines = nonemptyLines(raw);
  const filesLine = lines.find((line) => line.startsWith("files "));
  const bytesLine = lines.find((line) => /^\d+\s+\//.test(line));
  if (!filesLine || !bytesLine) return undefined;
  const files = Number(filesLine.slice("files ".length).trim());
  const bytes = Number(bytesLine.split(/\s+/)[0]);
  if (!isWhole(files) || !isWhole(bytes)) return undefined;
  return { files, bytes };
};

const parseCacheTop = (raw: string, isTruncated: boolean): CacheTopStats | undefined => {
  const lines = nonemptyLines(raw);
  const usable = isTruncated && lines.length > 0 ? lines.slice(0, -1) : lines;
  const total = usable.find((line) => line.startsWith("total "))?.match(/^total (\d+) (\d+)$/);
  if (!total) return undefined;
  const totalBytes = Number(total[1]);
  const totalFiles = Number(total[2]);
  if (!isWhole(totalBytes) || !isWhole(totalFiles)) return undefined;

  const focus: CacheUsage[] = [];
  const missingFocus: string[] = [];
  const rows: CacheUsage[] = [];
  const missingScopes: string[] = [];
  for (const line of usable) {
    if (line.startsWith("total ")) continue;
    const focusRow = line.match(/^focus (\d+) (\d+) (\S+)$/);
    if (focusRow) {
      focus.push({ bytes: Number(focusRow[1]), files: Number(focusRow[2]), name: focusRow[3] ?? "" });
      continue;
    }
    const focusMissing = line.match(/^focus missing (\S+)$/);
    if (focusMissing?.[1]) {
      missingFocus.push(focusMissing[1]);
      continue;
    }
    const row = line.match(/^(\d+) (\d+) (\S+)$/);
    if (row) {
      rows.push({ bytes: Number(row[1]), files: Number(row[2]), name: row[3] ?? "" });
      continue;
    }
    const missingScope = line.match(/^missing (\S+)$/);
    if (missingScope?.[1]) {
      missingScopes.push(missingScope[1]);
      continue;
    }
    return undefined;
  }

  const parsed = [...focus, ...rows];
  if (parsed.some((row) => !isWhole(row.bytes) || !isWhole(row.files) || row.name.length === 0)) return undefined;
  const covered = new Set([...focus.map((row) => row.name.split("/")[1]), ...missingFocus]);
  if (focusCacheNames.some((name) => !covered.has(name))) return undefined;
  return { totalBytes, totalFiles, focus, missingFocus, rows, missingScopes };
};

const usageLabel = (row: CacheUsage): string => `${row.name} ${formatMib(row.bytes)}, ${fileCountLabel(row.files)}`;

const fileCountLabel = (count: number): string => `${count} file${count === 1 ? "" : "s"}`;

const formatMib = (bytes: number): string => {
  const mib = bytes / (1024 * 1024);
  if (bytes > 0 && mib < 0.1) return `${mib.toFixed(2)} MiB`;
  return `${mib.toFixed(1)} MiB`;
};

const withTruncation = (summary: string, isTruncated: boolean): string =>
  isTruncated ? `${summary}; output truncated` : summary;

const nonemptyLines = (raw: string): string[] =>
  raw.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);

const isWhole = (value: number): boolean => Number.isSafeInteger(value) && value >= 0;

const runRemoteCommand = (command: string, keyPath: string, knownHosts: string): Promise<RemoteOutput> =>
  new Promise((resolve) => {
    const stdout = createCappedBuffer(maxOutputBytes);
    const stderr = createCappedBuffer(maxOutputBytes);
    let killed = false;
    let spawnError: string | undefined;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = (code: number | null, signal: NodeJS.Signals | null) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve({
        code,
        signal,
        stdout: stdout.text(),
        stderr: stderr.text(),
        stdoutTruncated: stdout.isTruncated(),
        stderrTruncated: stderr.isTruncated(),
        killed,
        spawnError,
      });
    };

    let child;
    try {
      child = spawn(
        "ssh",
        [
          "-i",
          keyPath,
          "-o",
          "BatchMode=yes",
          "-o",
          "IdentitiesOnly=yes",
          "-o",
          "StrictHostKeyChecking=yes",
          "-o",
          `UserKnownHostsFile=${knownHosts}`,
          "-o",
          "ConnectTimeout=10",
          `${sshUser}@${sshHost}`,
          command,
        ],
        { shell: false, stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (error) {
      spawnError = getErrorMessage(error);
      finish(null, null);
      return;
    }

    timer = setTimeout(() => {
      killed = true;
      child.kill("SIGKILL");
    }, sshTimeoutMs);

    child.stdout.on("data", (chunk: Buffer | string) => stdout.append(chunk));
    child.stderr.on("data", (chunk: Buffer | string) => stderr.append(chunk));
    child.on("error", (error) => {
      spawnError = getErrorMessage(error);
      setTimeout(() => finish(null, null), 0);
    });
    child.on("close", (code, signal) => finish(code, signal));
  });

const createCappedBuffer = (maxBytes: number): CappedBuffer => {
  let text = "";
  let bytes = 0;
  let isTruncated = false;

  return {
    append: (chunk) => {
      if (isTruncated) return;
      const incoming = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      if (bytes + incoming.length <= maxBytes) {
        text += incoming.toString("utf8");
        bytes += incoming.length;
        return;
      }
      text += incoming.subarray(0, maxBytes - bytes).toString("utf8");
      bytes = maxBytes;
      isTruncated = true;
    },
    text: () => text,
    isTruncated: () => isTruncated,
  };
};

const elapsedSince = (started: number): number => Math.round(performance.now() - started);
