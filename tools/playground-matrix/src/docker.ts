import { execFile, execFileSync, spawn, spawnSync } from "node:child_process";
import { createWriteStream, readFileSync, writeFileSync } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export function assertDockerAvailable(): void {
  try {
    execFileSync("docker", ["version", "--format", "{{.Server.Version}}"], { stdio: "pipe" });
  } catch {
    throw new Error(
      "Docker is not reachable. Start Docker Desktop (or your daemon) and try again.",
    );
  }
}

export function buildImage(options: {
  tag: string;
  contextDir: string;
  nodeVersion: string;
}): void {
  execFileSync(
    "docker",
    [
      "build",
      "--build-arg",
      `NODE_VERSION=${options.nodeVersion}`,
      "-t",
      options.tag,
      options.contextDir,
    ],
    { stdio: "inherit" },
  );
}

export type ContainerHandle = {
  id: string;
  logFile: string;
  stop: () => void;
};

export function runContainer(options: {
  image: string;
  name: string;
  env: Record<string, string>;
  mounts: Array<{ source: string; target: string; readonly?: boolean }>;
  publishPort?: number;
  logFile: string;
  memory?: string;
}): ContainerHandle {
  const args = ["run", "-d", "--name", options.name];

  if (options.memory) args.push("--memory", options.memory);
  if (options.publishPort) args.push("-p", `127.0.0.1::${options.publishPort}`);

  for (const [key, value] of Object.entries(options.env)) {
    args.push("-e", `${key}=${value}`);
  }

  for (const mount of options.mounts) {
    args.push(
      "--mount",
      `type=bind,source=${mount.source},target=${mount.target}${mount.readonly ? ",readonly" : ""}`,
    );
  }

  args.push(options.image);

  // Truncate up front and synchronously. `createWriteStream` opens lazily, so
  // without this the first poll can still see the previous run's log and
  // attribute its failure to this job.
  writeFileSync(options.logFile, "");

  const id = execFileSync("docker", args, { encoding: "utf8" }).trim();

  const logStream = createWriteStream(options.logFile, { flags: "a" });
  const logs = spawn("docker", ["logs", "-f", id], { stdio: ["ignore", "pipe", "pipe"] });
  logs.stdout.pipe(logStream, { end: false });
  logs.stderr.pipe(logStream, { end: false });

  return {
    id,
    logFile: options.logFile,
    stop: () => {
      logs.kill("SIGKILL");
      logStream.end();
      try {
        execFileSync("docker", ["rm", "-f", id], { stdio: "pipe" });
      } catch {
        // already gone
      }
    },
  };
}

export async function hostPortFor(containerId: string, containerPort: number): Promise<number> {
  const { stdout } = await execFileAsync("docker", ["port", containerId, String(containerPort)]);
  const match = stdout
    .trim()
    .split("\n")[0]
    ?.match(/:(\d+)$/);
  if (!match) throw new Error(`Could not determine host port for ${containerId}:${containerPort}`);
  return Number(match[1]);
}

export type PhaseOutcome =
  | { kind: "phase"; phase: string }
  | { kind: "fail"; phase: string }
  | { kind: "exit"; code: number }
  | { kind: "timeout" };

/**
 * Waits for the container to reach a phase marker, fail, or exit.
 *
 * Polling the log file rather than holding the stream open keeps this
 * resilient to the container dying mid-write, which is exactly the case that
 * matters when an install runs the machine out of memory.
 */
export async function waitForPhase(
  handle: ContainerHandle,
  targetPhases: string[],
  timeoutMs: number,
): Promise<PhaseOutcome> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const log = safeRead(handle.logFile);

    const failure = log.match(/__MATRIX_FAIL__(\w+)__/);
    if (failure) return { kind: "fail", phase: failure[1]! };

    for (const phase of targetPhases) {
      if (log.includes(`__MATRIX_PHASE__${phase}__`)) return { kind: "phase", phase };
    }

    const exitCode = await containerExitCode(handle.id);
    if (exitCode !== undefined) {
      // The follow pipe can still be behind the container. Re-read once so an
      // exit does not mask the marker that says which phase actually failed.
      snapshotLogs(handle.id, handle.logFile);
      const final = safeRead(handle.logFile);
      const lateFailure = final.match(/__MATRIX_FAIL__(\w+)__/);
      if (lateFailure) return { kind: "fail", phase: lateFailure[1]! };
      for (const phase of targetPhases) {
        if (final.includes(`__MATRIX_PHASE__${phase}__`)) return { kind: "phase", phase };
      }
      return { kind: "exit", code: exitCode };
    }

    await sleep(500);
  }

  return { kind: "timeout" };
}

async function containerExitCode(id: string): Promise<number | undefined> {
  try {
    const { stdout } = await execFileAsync("docker", [
      "inspect",
      "-f",
      "{{.State.Running}} {{.State.ExitCode}}",
      id,
    ]);
    const [running, code] = stdout.trim().split(" ");
    return running === "false" ? Number(code) : undefined;
  } catch {
    return undefined;
  }
}

export async function waitForHttp(url: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "follow" });
      if (response.status < 500) return true;
    } catch {
      // not up yet
    }
    await sleep(500);
  }

  return false;
}

/**
 * Replaces the followed log with the container's own record of it.
 *
 * The follow pipe is there so the orchestrator can react to phase markers while
 * the job runs; it is not a reliable archive, because the container can die
 * mid-write. `docker logs` is.
 */
export function snapshotLogs(containerId: string, logFile: string): void {
  // `docker logs` writes the container's stderr to *its own* stderr, so both
  // streams have to be captured and concatenated. A build tool reports its
  // failure on stderr; losing it turns every build failure into a blank log.
  const result = spawnSync("docker", ["logs", containerId], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });

  if (result.error || result.status === null) return; // container already reaped

  writeFileSync(logFile, `${result.stdout ?? ""}${result.stderr ?? ""}`);
}

export function safeRead(file: string): string {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

/** The verifier's findings, fished back out of the container log. */
export function extractVerifyFindings(
  log: string,
): Array<{ level: string; check: string; message: string }> {
  const match = log.match(/__MATRIX_VERIFY__(.*?)__MATRIX_VERIFY__/s);
  if (!match) return [];
  try {
    return JSON.parse(match[1]!);
  } catch {
    return [];
  }
}

export type BuildMetrics = {
  build?: TreeMetrics;
  fingerprints?: Record<string, number>;
  install: TreeMetrics;
  packages: Record<string, TreeMetrics & { version: string }>;
};

export type TreeMetrics = {
  dir: string;
  files: number;
  bytes: number;
  gzipBytes?: number;
  byExtension: Record<string, { files: number; bytes: number }>;
};

/** The measurer's output, fished back out of the container log. */
export function extractMetrics(log: string): BuildMetrics | undefined {
  const match = log.match(/__MATRIX_METRICS__(.*?)__MATRIX_METRICS__/s);
  if (!match) return undefined;
  try {
    return JSON.parse(match[1]!) as BuildMetrics;
  } catch {
    return undefined;
  }
}

export function extractBuildMs(log: string): number | undefined {
  const match = log.match(/__MATRIX_BUILD_MS__(\d+)__/);
  return match ? Number(match[1]) : undefined;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
