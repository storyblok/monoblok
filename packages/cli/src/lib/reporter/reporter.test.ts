import { expect, it } from "vitest";
import { vol } from "memfs";
import * as nodeFs from "node:fs";
import { REPORT_STATUS, Reporter } from "./reporter";
import { getRunFileName } from "../../utils/filesystem";

it("should compute status and write report when enabled", () => {
  const reporterSuccess = new Reporter({ enabled: true, filePath: "./success.json" });
  reporterSuccess.addSummary("jobs", { total: 3, succeeded: 3, failed: 0 });
  reporterSuccess.finalize();

  const reporterSuccessSkipped = new Reporter({
    enabled: true,
    filePath: "./success-skipped.json",
  });
  reporterSuccessSkipped.addSummary("jobs", { total: 3, succeeded: 0, skipped: 3, failed: 0 });
  reporterSuccessSkipped.finalize();

  const reporterPartial = new Reporter({ enabled: true, filePath: "./partial.json" });
  reporterPartial.addSummary("jobs", { total: 3, succeeded: 2, failed: 1 });
  reporterPartial.finalize();

  const reporterFailure = new Reporter({ enabled: true, filePath: "./failure.json" });
  reporterFailure.addSummary("jobs", { total: 2, succeeded: 0, failed: 2 });
  reporterFailure.finalize();

  const files = vol.toJSON();

  // Success
  const success = JSON.parse(
    files[Object.keys(files).find((k) => k.includes("success.json"))!] as string,
  );
  expect(success.status).toBe(REPORT_STATUS.success);
  expect(success.summary.jobs).toEqual({ total: 3, succeeded: 3, failed: 0 });

  // Success (all skipped)
  const successSkipped = JSON.parse(
    files[Object.keys(files).find((k) => k.includes("success-skipped.json"))!] as string,
  );
  expect(successSkipped.status).toBe(REPORT_STATUS.success);
  expect(successSkipped.summary.jobs).toEqual({ total: 3, succeeded: 0, skipped: 3, failed: 0 });

  // Partial success
  const partial = JSON.parse(
    files[Object.keys(files).find((k) => k.includes("partial.json"))!] as string,
  );
  expect(partial.status).toBe(REPORT_STATUS.partialSuccess);
  expect(partial.summary.jobs).toEqual({ total: 3, succeeded: 2, failed: 1 });

  // Failure
  const failure = JSON.parse(
    files[Object.keys(files).find((k) => k.includes("failure.json"))!] as string,
  );
  expect(failure.status).toBe(REPORT_STATUS.failure);
  expect(failure.summary.jobs).toEqual({ total: 2, succeeded: 0, failed: 2 });
});

it("should only keep n number of report files", () => {
  for (const runId of [1, 2, 3, 4, 5]) {
    new Reporter({ enabled: true, filePath: `./report-${runId}.json`, maxFiles: 3 }).finalize();
  }

  expect(Reporter.listReportFiles(".")).toEqual([
    "report-3.json",
    "report-4.json",
    "report-5.json",
  ]);
});

it("should not write a report when disabled", () => {
  const reporter = new Reporter({ enabled: false, filePath: "./disabled.json" });
  reporter.finalize();

  const files = Object.keys(vol.toJSON());
  expect(files).toHaveLength(0);
});

it("should prune the oldest runs regardless of command name or modification time", () => {
  const oldestRun = getRunFileName(["storyblok", "stories", "pull"], 1000, ".json");
  const olderRun = getRunFileName(["storyblok", "stories", "pull"], 2000, ".json");
  const newestRun = getRunFileName(["storyblok", "schema", "push"], 3000, ".json");
  vol.fromJSON({ [oldestRun]: "{}", [olderRun]: "{}" });
  nodeFs.utimesSync(oldestRun, new Date(2000), new Date(2000));
  nodeFs.utimesSync(olderRun, new Date(1000), new Date(1000));

  new Reporter({ enabled: true, filePath: newestRun, maxFiles: 2 }).finalize();

  expect(Reporter.listReportFiles(".")).toEqual([olderRun, newestRun]);
});

it("should keep its own report when runs that started later already finished", () => {
  vol.fromJSON({ "./stories-pull-2000.json": "{}", "./stories-pull-3000.json": "{}" });

  new Reporter({ enabled: true, filePath: "./migrations-run-1000.json", maxFiles: 2 }).finalize();

  expect(Reporter.listReportFiles(".")).toEqual([
    "migrations-run-1000.json",
    "stories-pull-3000.json",
  ]);
});

it("should ignore files without a run ID", () => {
  vol.fromJSON({ "./notes.json": "{}", "./stories-pull-1000.json": "{}" });

  expect(Reporter.listReportFiles(".")).toEqual(["stories-pull-1000.json"]);
  expect(Reporter.pruneReportFiles(".", 0)).toBe(1);
  expect(nodeFs.existsSync("./notes.json")).toBe(true);
});

it("should return the number of deleted files when keep is negative", () => {
  vol.fromJSON({ "./a-1000.json": "{}", "./b-2000.json": "{}" });

  expect(Reporter.pruneReportFiles(".", -1)).toBe(2);
});
