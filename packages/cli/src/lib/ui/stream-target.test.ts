import type { Stats } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

const { fstatSync } = vi.hoisted(() => ({ fstatSync: vi.fn() }));

vi.mock("node:fs", () => ({ fstatSync }));

const { getStderrTarget, getStdoutTarget } = await import("./stream-target");

/**
 * `isTTY` is a plain data property that Node omits entirely when the descriptor
 * is not a terminal, so it is set and restored rather than spied on.
 */
function withTTY(stream: NodeJS.WriteStream, value: boolean | undefined, run: () => void) {
  const original = Object.getOwnPropertyDescriptor(stream, "isTTY");
  if (value === undefined) {
    delete (stream as { isTTY?: boolean }).isTTY;
  } else {
    Object.defineProperty(stream, "isTTY", { value, configurable: true });
  }
  try {
    run();
  } finally {
    if (original) {
      Object.defineProperty(stream, "isTTY", original);
    } else {
      delete (stream as { isTTY?: boolean }).isTTY;
    }
  }
}

/** Only the four predicates `classify` consults. */
const statAs = (kind: "file" | "fifo" | "socket" | "chardev" | "other") =>
  ({
    isFile: () => kind === "file",
    isFIFO: () => kind === "fifo",
    isSocket: () => kind === "socket",
    isCharacterDevice: () => kind === "chardev",
  }) as Stats;

afterEach(() => {
  vi.clearAllMocks();
});

describe("getStdoutTarget", () => {
  it("should report a terminal without consulting fstat", () => {
    withTTY(process.stdout, true, () => {
      expect(getStdoutTarget()).toBe("terminal");
    });
    expect(fstatSync).not.toHaveBeenCalled();
  });

  // `sb stories find > out.json`: nothing is reading the far end, so a caller
  // is free to batch its writes.
  it("should report a file for a redirect to disk", () => {
    fstatSync.mockReturnValue(statAs("file"));
    withTTY(process.stdout, undefined, () => {
      expect(getStdoutTarget()).toBe("file");
    });
    expect(fstatSync).toHaveBeenCalledWith(1);
  });

  // `sb stories find | jq .`: a consumer may be acting on each line.
  it("should report a pipe for a FIFO", () => {
    fstatSync.mockReturnValue(statAs("fifo"));
    withTTY(process.stdout, undefined, () => {
      expect(getStdoutTarget()).toBe("pipe");
    });
  });

  it("should report a pipe for a socket", () => {
    fstatSync.mockReturnValue(statAs("socket"));
    withTTY(process.stdout, undefined, () => {
      expect(getStdoutTarget()).toBe("pipe");
    });
  });

  // `> /dev/null`: a character device, but `isTTY` is unset, so it is not a
  // terminal and must not be mistaken for one.
  it("should report a device for a non-terminal character device", () => {
    fstatSync.mockReturnValue(statAs("chardev"));
    withTTY(process.stdout, undefined, () => {
      expect(getStdoutTarget()).toBe("device");
    });
  });

  it("should report unknown for a descriptor fstat cannot classify", () => {
    fstatSync.mockReturnValue(statAs("other"));
    withTTY(process.stdout, undefined, () => {
      expect(getStdoutTarget()).toBe("unknown");
    });
  });

  // A closed descriptor is a diagnostic detail, not grounds for taking the
  // command down with an EBADF.
  it("should report unknown instead of throwing when fstat fails", () => {
    fstatSync.mockImplementation(() => {
      throw Object.assign(new Error("EBADF"), { code: "EBADF" });
    });
    withTTY(process.stdout, undefined, () => {
      expect(getStdoutTarget()).toBe("unknown");
    });
  });
});

describe("getStderrTarget", () => {
  it("should report a terminal when stderr is a TTY", () => {
    withTTY(process.stderr, true, () => {
      expect(getStderrTarget()).toBe("terminal");
    });
  });

  // `sb stories find > out.json 2> run.log` — the case the redraw guard exists
  // for: stdout and stderr are classified independently.
  it("should classify stderr independently of stdout", () => {
    fstatSync.mockReturnValue(statAs("file"));
    withTTY(process.stdout, true, () => {
      withTTY(process.stderr, undefined, () => {
        expect(getStdoutTarget()).toBe("terminal");
        expect(getStderrTarget()).toBe("file");
      });
    });
    expect(fstatSync).toHaveBeenCalledWith(2);
  });
});
