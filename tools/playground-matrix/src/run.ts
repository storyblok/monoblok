import { mkdirSync } from "node:fs";
import path from "node:path";

import type { Browser } from "playwright";

import type { Job } from "./config.ts";
import type { BuildMetrics } from "./docker.ts";
import {
  assertDockerAvailable,
  buildImage,
  extractBuildMs,
  extractMetrics,
  extractVerifyFindings,
  hostPortFor,
  runContainer,
  safeRead,
  snapshotLogs,
  waitForHttp,
  waitForPhase,
} from "./docker.ts";
import { smokeTest } from "./smoke.ts";
import type { SmokeResult } from "./smoke.ts";
import { CONTAINER_TARBALL_DIR } from "./stage.ts";
import { repoRoot } from "./workspace.ts";

export type JobResult = {
  job: string;
  playground: string;
  packageManager: string;
  node: string;
  status: "passed" | "failed";
  failedPhase?: string;
  durationMs: number;
  verify: Array<{ level: string; check: string; message: string }>;
  smoke?: SmokeResult;
  buildMs?: number;
  metrics?: BuildMetrics;
  logFile: string;
  notes: string[];
};

const INSTALL_BUILD_TIMEOUT_MS = 20 * 60 * 1000;
const SERVE_TIMEOUT_MS = 3 * 60 * 1000;

export function imageTag(nodeVersion: string): string {
  return `monoblok-playground-matrix:node${nodeVersion}`;
}

export function prepareImages(nodeVersions: string[]): void {
  assertDockerAvailable();
  const contextDir = path.join(repoRoot(), "tools/playground-matrix/docker");

  for (const version of nodeVersions) {
    buildImage({ tag: imageTag(version), contextDir, nodeVersion: version });
  }
}

export async function runJob(options: {
  job: Job;
  stageDir: string;
  tarballDir: string;
  logDir: string;
  expectedVersions: Record<string, string>;
  browser: Browser | undefined;
  /** Distinguishes containers when two runs share a Docker daemon. */
  runId: string;
}): Promise<JobResult> {
  const { job, browser } = options;
  const started = Date.now();
  const notes: string[] = [];

  mkdirSync(options.logDir, { recursive: true });
  const logFile = path.join(options.logDir, `${job.id}.log`);

  const containerPort = "port" in job.playground.serve ? job.playground.serve.port : 3000;
  const needsServer = job.playground.serve.type !== "none";

  const env: Record<string, string> = {
    MATRIX_PM: job.packageManager.pm,
    MATRIX_PM_VERSION: job.packageManager.version,
    MATRIX_LINKER: job.packageManager.linker,
    MATRIX_APP_DIR: job.playground.appDir,
    MATRIX_BUILD_SCRIPT: job.playground.build,
    MATRIX_SERVE_TYPE: job.playground.serve.type,
    MATRIX_PORT: String(containerPort),
    MATRIX_PACKAGES: job.playground.covers.join(","),
    MATRIX_EXPECTED_VERSIONS: JSON.stringify(options.expectedVersions),
  };

  if (job.playground.dist) env.MATRIX_DIST_DIR = job.playground.dist;
  if (job.playground.fingerprints) {
    env.MATRIX_FINGERPRINTS = JSON.stringify(job.playground.fingerprints);
  }

  if (job.playground.serve.type === "static") env.MATRIX_SERVE_DIR = job.playground.serve.dir;
  if (job.playground.serve.type === "script") env.MATRIX_SERVE_SCRIPT = job.playground.serve.script;
  if (job.playground.serve.type === "node") env.MATRIX_SERVE_ENTRY = job.playground.serve.entry;

  const container = runContainer({
    image: imageTag(job.node.version),
    name: `matrix-${job.id}-${options.runId}`.replace(/[^a-zA-Z0-9_.-]/g, "-"),
    env,
    mounts: [
      {
        source: path.join(path.resolve(options.stageDir), job.playground.id),
        target: "/stage",
        readonly: true,
      },
      { source: path.resolve(options.tarballDir), target: CONTAINER_TARBALL_DIR, readonly: true },
    ],
    publishPort: needsServer ? containerPort : undefined,
    logFile,
  });

  const finish = (
    status: JobResult["status"],
    failedPhase?: string,
    smoke?: SmokeResult,
  ): JobResult => {
    snapshotLogs(container.id, logFile);
    const log = safeRead(logFile);
    container.stop();
    return {
      job: job.id,
      playground: job.playground.id,
      packageManager: job.packageManager.id,
      node: job.node.id,
      status,
      failedPhase,
      durationMs: Date.now() - started,
      verify: extractVerifyFindings(log),
      buildMs: extractBuildMs(log),
      metrics: extractMetrics(log),
      smoke,
      logFile,
      notes,
    };
  };

  try {
    const outcome = await waitForPhase(
      container,
      needsServer ? ["serve"] : ["done"],
      INSTALL_BUILD_TIMEOUT_MS,
    );

    if (outcome.kind === "fail") return finish("failed", outcome.phase);
    if (outcome.kind === "timeout") return finish("failed", "timeout");
    if (outcome.kind === "exit") {
      return finish(outcome.code === 0 && !needsServer ? "passed" : "failed", "exit");
    }

    if (!needsServer) {
      notes.push("build-only: this playground has no locally runnable server");
      return finish("passed");
    }

    const port = await hostPortFor(container.id, containerPort);
    const url = `http://127.0.0.1:${port}/`;

    if (!(await waitForHttp(url, SERVE_TIMEOUT_MS))) {
      return finish("failed", "serve");
    }

    if (!browser) {
      notes.push("smoke skipped: no browser available");
      return finish("passed");
    }

    const smoke = await smokeTest({ browser, url, playground: job.playground });
    return finish(smoke.ok ? "passed" : "failed", smoke.ok ? undefined : "smoke", smoke);
  } catch (error) {
    notes.push((error as Error).message);
    return finish("failed", "orchestrator");
  }
}

/** Runs jobs with a bounded number of containers alive at once. */
export async function runAll(
  jobs: Job[],
  concurrency: number,
  run: (job: Job) => Promise<JobResult>,
  onResult: (result: JobResult) => void,
): Promise<JobResult[]> {
  const results: JobResult[] = [];
  const queue = [...jobs];

  const worker = async (): Promise<void> => {
    for (;;) {
      const job = queue.shift();
      if (!job) return;
      const result = await run(job);
      results.push(result);
      onResult(result);
    }
  };

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  return results;
}
