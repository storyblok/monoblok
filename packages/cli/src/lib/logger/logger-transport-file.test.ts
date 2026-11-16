import { expect, it, vi } from "vitest";
import { vol } from "memfs";
import * as nodeFs from "node:fs";
import { FileTransport } from "./logger-transport-file";
import { getRunFileName } from "../../utils/filesystem";
import { APIError } from "../../utils/error";
import { FetchError } from "../../utils/fetch";

it("should only log level equal or more severe to the specified level", () => {
  // Error
  const transportLevelError = new FileTransport({ level: "error" });
  transportLevelError.log({ level: "error", message: "Error!" });
  transportLevelError.log({ level: "warn", message: "Warn!" });
  transportLevelError.log({ level: "info", message: "Info" });
  transportLevelError.log({ level: "debug", message: "Debug" });
  expect(Object.values(vol.toJSON())[0]?.trim()).toMatch(
    /^\{"timestamp":"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z","level":"ERROR","message":"Error!"\}$/,
  );

  // Info
  vol.reset();
  const transportLevelInfo = new FileTransport({ level: "info" });
  transportLevelInfo.log({ level: "error", message: "Error!" });
  transportLevelInfo.log({ level: "warn", message: "Warn!" });
  transportLevelInfo.log({ level: "info", message: "Info" });
  transportLevelInfo.log({ level: "debug", message: "Debug" });
  expect(Object.values(vol.toJSON())[0]?.trim()).toMatch(
    /^\{"timestamp":"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z","level":"ERROR","message":"Error!"\}\n\{"timestamp":"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z","level":"WARN","message":"Warn!"\}\n\{"timestamp":"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z","level":"INFO","message":"Info"\}$/,
  );
});

it("should format errors correctly", () => {
  const transport = new FileTransport();
  const apiError = new APIError(
    "network_error",
    "get_user",
    new FetchError("foo error", {
      status: 418,
      statusText: "foo",
    }),
  );
  transport.log({ level: "error", message: "Error!", context: { apiError } });
  expect(
    JSON.parse(Object.values(vol.toJSON())[0]?.trim() as string).context.apiError,
  ).toMatchObject({
    name: "API Error",
    message: "No response from server, please check if you are correctly connected to internet",
    httpCode: 418,
    httpStatusText: "foo",
    stack: expect.any(String),
  });
});

it("should only keep n number of log files", () => {
  const maxFiles = 3;

  new FileTransport({ filePath: "run-1.jsonl", maxFiles }).log({ level: "info", message: "Log 1" });
  new FileTransport({ filePath: "run-2.jsonl", maxFiles }).log({ level: "info", message: "Log 2" });
  new FileTransport({ filePath: "run-3.jsonl", maxFiles }).log({ level: "info", message: "Log 3" });
  new FileTransport({ filePath: "run-4.jsonl", maxFiles }).log({ level: "info", message: "Log 4" });
  new FileTransport({ filePath: "run-5.jsonl", maxFiles }).log({ level: "info", message: "Log 5" });

  const files = Object.keys(vol.toJSON()).sort();
  const fileContents = Object.values(vol.toJSON());

  expect(files).toHaveLength(maxFiles);
  // Verify oldest files (Log 1 and Log 2) were deleted
  expect(fileContents.some((content) => content?.includes("Log 1"))).toBe(false);
  expect(fileContents.some((content) => content?.includes("Log 2"))).toBe(false);
  // Verify newest files (Log 3, 4, 5) remain
  expect(fileContents.some((content) => content?.includes("Log 3"))).toBe(true);
  expect(fileContents.some((content) => content?.includes("Log 4"))).toBe(true);
  expect(fileContents.some((content) => content?.includes("Log 5"))).toBe(true);
});

it("should not throw when a pruned file was already removed by a concurrent process", () => {
  vol.fromJSON({ "./a-1.jsonl": "a", "./b-2.jsonl": "b", "./c-3.jsonl": "c" });

  // Simulate the race: between `readdirSync` and `unlinkSync` another CLI
  // process deletes the same oldest file, so the first `unlinkSync` raises
  // ENOENT. Pruning must swallow it and keep deleting the remaining files.
  const enoent = Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" });
  const unlinkSpy = vi.spyOn(nodeFs, "unlinkSync").mockImplementationOnce(() => {
    throw enoent;
  });

  let deleted = 0;
  expect(() => {
    deleted = FileTransport.pruneLogFiles(".", 1);
  }).not.toThrow();

  expect(deleted).toBe(2);
  const remaining = Object.keys(vol.toJSON())
    .map((p) => p.split("/").pop())
    .sort();
  expect(remaining).not.toContain("b-2.jsonl");
  expect(remaining).toContain("c-3.jsonl");

  unlinkSpy.mockRestore();
});

it("should rethrow non-ENOENT errors while pruning", () => {
  vol.fromJSON({ "./a-1.jsonl": "a", "./b-2.jsonl": "b" });

  const eacces = Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });
  const unlinkSpy = vi.spyOn(nodeFs, "unlinkSync").mockImplementationOnce(() => {
    throw eacces;
  });

  expect(() => FileTransport.pruneLogFiles(".", 1)).toThrow("EACCES");

  unlinkSpy.mockRestore();
});

it("should prune the oldest runs regardless of command name or modification time", () => {
  const oldestRun = getRunFileName(["storyblok", "stories", "pull"], 1000, ".jsonl");
  const olderRun = getRunFileName(["storyblok", "stories", "pull"], 2000, ".jsonl");
  const newestRun = getRunFileName(["storyblok", "schema", "push"], 3000, ".jsonl");
  vol.fromJSON({ [oldestRun]: "{}", [olderRun]: "{}" });
  nodeFs.utimesSync(oldestRun, new Date(2000), new Date(2000));
  nodeFs.utimesSync(olderRun, new Date(1000), new Date(1000));

  new FileTransport({ filePath: newestRun, maxFiles: 2 }).log({ level: "info", message: "Log 3" });

  const remaining = Object.keys(vol.toJSON()).map((path) => path.split("/").pop());
  expect(remaining.sort()).toEqual([newestRun, olderRun]);
});

it("should keep its own log file when runs that started later already finished", () => {
  vol.fromJSON({ "./stories-pull-2000.jsonl": "{}", "./stories-pull-3000.jsonl": "{}" });

  new FileTransport({ filePath: "./migrations-run-1000.jsonl", maxFiles: 2 }).log({
    level: "info",
    message: "Started",
  });

  const remaining = Object.keys(vol.toJSON()).map((path) => path.split("/").pop());
  expect(remaining.sort()).toEqual(["migrations-run-1000.jsonl", "stories-pull-3000.jsonl"]);
});

it("should skip directories while pruning", () => {
  vol.fromJSON({ "./old-1000.jsonl/file": "", "./run-2000.jsonl": "{}" });

  expect(FileTransport.pruneLogFiles(".", 0)).toBe(1);
  expect(nodeFs.existsSync("./old-1000.jsonl")).toBe(true);
  expect(nodeFs.existsSync("./run-2000.jsonl")).toBe(false);
});
