import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { MalformedInputError, readRecords } from "./input";

const stdin = (...chunks: string[]) => Readable.from(chunks);

describe("readRecords", () => {
  it("should read one record per JSONL line", async () => {
    const records = await readRecords(stdin('{"id":1}\n{"id":2}\n'));

    expect(records.map(({ value }) => value)).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("should read a single pretty-printed object", async () => {
    const records = await readRecords(stdin('{\n  "id": 1,\n  "name": "a}"\n}\n'));

    expect(records.map(({ value }) => value)).toEqual([{ id: 1, name: "a}" }]);
  });

  it("should read objects written back to back", async () => {
    const records = await readRecords(stdin('{"id":1}{"id":2} {\n"id":3}'));

    expect(records.map(({ value }) => value)).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it("should read a record split across chunks", async () => {
    const records = await readRecords(stdin('{"id":1,"na', 'me":"x"}\n'));

    expect(records.map(({ value }) => value)).toEqual([{ id: 1, name: "x" }]);
  });

  it("should give each record the line it starts on, counting blank lines", async () => {
    const records = await readRecords(stdin('{"id":1}\n\n{\n"id":2\n}\n{"id":3}'));

    expect(records.map(({ line }) => line)).toEqual([1, 3, 6]);
  });

  it("should suggest splitting a JSON array into records", async () => {
    await expect(readRecords(stdin('[{"id":1}]'))).rejects.toThrow("jq -c '.[]'");
  });

  it("should read nothing from empty input", async () => {
    expect(await readRecords(stdin("", "\n  \n"))).toEqual([]);
  });

  it("should name the malformed record without echoing its content", async () => {
    const reading = readRecords(stdin('{"id":1}\n{"secret":"s3cret",}\n'));

    await expect(reading).rejects.toThrow(MalformedInputError);
    await expect(reading).rejects.toThrow(/record 2 \(line 2\)/);
    await expect(reading).rejects.not.toThrow(/s3cret/);
  });

  it("should reject a value that is not an object", async () => {
    await expect(readRecords(stdin('{"id":1}\n[1,2]\n'))).rejects.toThrow(/record 2/);
  });

  it("should reject an unterminated object", async () => {
    await expect(readRecords(stdin('{"id":1'))).rejects.toThrow(/record 1/);
  });
});
