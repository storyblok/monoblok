import { afterEach, describe, expect, it, vi } from "vitest";
import { getLogger, Logger, resetLogger, setLoggerTransports } from "./logger";
import type { LogRecord, LogTransport } from "./logger";

const createThrowingTransport = (): LogTransport => ({
  log: () => {
    throw new Error("disk full");
  },
});

const createRecordingTransport = () => {
  const records: LogRecord[] = [];
  const transport: LogTransport = {
    log: (record) => {
      records.push(record);
    },
  };
  return { records, transport };
};

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should not throw when a transport throws", () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const logger = new Logger({ transports: [createThrowingTransport()] });

    expect(() => logger.error("Failed to update story")).not.toThrow();
  });

  it("should keep logging to the other transports when one throws", () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const { records, transport } = createRecordingTransport();
    const logger = new Logger({ transports: [createThrowingTransport(), transport] });

    logger.error("Failed to update story", { storyId: 1 });
    logger.info("Updated story", { storyId: 2 });

    expect(records.map((record) => record.message)).toEqual([
      "Failed to update story",
      "Updated story",
    ]);
  });

  it("should report a failing transport to stderr only once", () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const logger = new Logger({ transports: [createThrowingTransport()] });

    logger.error("first");
    logger.error("second");

    expect(stderrSpy).toHaveBeenCalledTimes(1);
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("disk full"));
  });

  it("should report a failing transport again after the transports are replaced", () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    resetLogger();
    const logger = getLogger({ transports: [createThrowingTransport()] });

    logger.error("first");
    setLoggerTransports([createThrowingTransport()]);
    logger.error("second");

    expect(stderrSpy).toHaveBeenCalledTimes(2);
    resetLogger();
  });
});
