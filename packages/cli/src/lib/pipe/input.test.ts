import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createJsonlSource, isStdinArgument, probeStdin, STDIN_ARGUMENT } from "./input";

const jsonl = (...lines: string[]): Readable => Readable.from([`${lines.join("\n")}\n`]);

const collect = async (source: Readable): Promise<unknown[]> => {
  const received: unknown[] = [];
  for await (const value of source) {
    received.push(value);
  }
  return received;
};

describe("createJsonlSource", () => {
  it("should yield one parsed document per line", async () => {
    const source = createJsonlSource({ input: jsonl('{"id":1}', '{"id":2}') });

    await expect(collect(source)).resolves.toEqual([{ id: 1 }, { id: 2 }]);
  });

  // A trailing newline is how a line-oriented file ends, not a record.
  it("should skip blank lines", async () => {
    const source = createJsonlSource({ input: jsonl('{"id":1}', "", "   ", '{"id":2}') });

    await expect(collect(source)).resolves.toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("should read lines written with CRLF endings", async () => {
    const source = createJsonlSource({ input: Readable.from(['{"id":1}\r\n{"id":2}\r\n']) });

    await expect(collect(source)).resolves.toEqual([{ id: 1 }, { id: 2 }]);
  });

  // Skipping it silently would make a truncated producer look like a clean short
  // read, which answers a different question than the one asked.
  it("should fail the run on a malformed line, naming it", async () => {
    const source = createJsonlSource({ input: jsonl('{"id":1}', "{not json") });

    await expect(collect(source)).rejects.toThrow(/input line 2/);
  });

  it("should report and skip a malformed line when the caller asks it to", async () => {
    const reported: number[] = [];
    const source = createJsonlSource({
      input: jsonl('{"id":1}', "{not json", '{"id":3}'),
      onLineError: (_error, lineNumber) => reported.push(lineNumber),
    });

    await expect(collect(source)).resolves.toEqual([{ id: 1 }, { id: 3 }]);
    expect(reported).toEqual([2]);
  });

  it("should report the line number a document came from", async () => {
    const seen: number[] = [];
    const source = createJsonlSource({
      input: jsonl('{"id":1}', "", '{"id":3}'),
      onLineRead: (_value, lineNumber) => seen.push(lineNumber),
    });

    await collect(source);

    expect(seen).toEqual([1, 3]);
  });

  // The line number has to be right at the point of failure, which is why `map`
  // runs inside the reader rather than in a stage of its own: a `Readable`
  // buffers ahead of its consumer.
  it("should map each document, with the line it came from", async () => {
    const source = createJsonlSource<string>({
      input: jsonl('{"id":1}', '{"id":2}'),
      map: (value, lineNumber) => `${lineNumber}:${(value as { id: number }).id}`,
    });

    await expect(collect(source)).resolves.toEqual(["1:1", "2:2"]);
  });
});

describe("isStdinArgument", () => {
  it("should recognise the stdin argument", () => {
    expect(isStdinArgument(STDIN_ARGUMENT)).toBe(true);
  });

  it("should not treat anything else as stdin", () => {
    expect(isStdinArgument(undefined)).toBe(false);
    expect(isStdinArgument("--")).toBe(false);
    expect(isStdinArgument("stories.jsonl")).toBe(false);
  });
});

describe("probeStdin", () => {
  it("should report an unusable descriptor as empty rather than throwing", () => {
    expect(probeStdin(Number.MAX_SAFE_INTEGER)).toBe("empty");
  });
});
