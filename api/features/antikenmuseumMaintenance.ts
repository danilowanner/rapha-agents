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

const checkSchema = z.enum([
  "snapshot",
  "mysql",
  "oom",
  "http",
  "cert",
  "logs_apache",
  "logs_flow",
  "logs_mysql",
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

const sshCommands = {
  snapshot: "free -m; echo '---'; cat /proc/loadavg; echo '---'; df -h / /var",
  mysql: "systemctl is-active mysql; echo '---'; mysqladmin --protocol=socket ping",
  oom: "journalctl -k -n 50 --no-pager",
  cert: "certbot certificates",
  logs_apache: "tail -n 80 /var/log/apache2/error.log",
  logs_flow: "tail -n 80 /var/www/builds/live/Data/Logs/System_Production.log",
  logs_mysql: "tail -n 80 /var/log/mysql/error.log",
} as const satisfies Record<SshCheck, string>;

const antikenmuseumMaintenanceDescription = [
  "Read-only checks for the Antikenmuseum server basilisk.antikenmuseumbasel.ch. One check per call. No restarts, deploys, or user admin.",
  "Do not request https://antikenmuseumbasel.ch. That apex is on Cyon, not this server.",
  "Flow logs can contain secrets. Do not repeat raw into chat unless asked.",
  "snapshot: memory, load average, and disk for / and /var.",
  "mysql: mysql active state and a socket ping.",
  "oom: last 50 kernel journal lines.",
  "http: fetch https://www.antikenmuseumbasel.ch. Returns status and elapsed milliseconds.",
  "cert: certbot certificates. Exit 0 does not mean the certificate is valid.",
  "logs_apache: last 80 lines of the Apache error log.",
  "logs_flow: last 80 lines of the live Flow production log.",
  "logs_mysql: last 80 lines of the MySQL error log.",
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
  const ok = output.code === 0;
  const raw = ok ? output.stdout : output.stderr || output.spawnError || "";
  const isTruncated = ok ? output.stdoutTruncated : output.stderrTruncated;
  const failure = output.killed
    ? "timed out"
    : output.spawnError
      ? `failed: ${output.spawnError}`
      : output.code === null
        ? `signal ${output.signal ?? "unknown"}`
        : `exit ${output.code}`;

  return { check, ok, summary: sshSummary(check, ok, failure, raw, isTruncated), raw };
};

const sshSummary = (check: SshCheck, ok: boolean, failure: string, raw: string, isTruncated: boolean): string => {
  const flags = ["INVALID", "EXPIRED"].filter((flag) => raw.includes(flag));
  const status = flags.length === 0 ? (ok ? "ok" : failure) : ok ? flags.join(", ") : `${failure}; ${flags.join(", ")}`;
  return isTruncated ? `${check} ${status}; output truncated` : `${check} ${status}`;
};

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
