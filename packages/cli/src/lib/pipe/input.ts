// The consuming end of the pipe: records read from stdin when a command is
// passed `-`. Accepts what producers and people send: JSONL from another CLI
// command, one pretty-printed object from `jq .` or a hand-written file, or
// objects written back to back. All of stdin is read before anything is
// returned, so a malformed record fails the run before its first write.

import type { Readable } from "node:stream";
import { isRecord } from "../../utils/object";

export type InputRecord = Record<string, unknown>;

/**
 * A record that is not a JSON object. The message names the record and the
 * line it starts on, never its content: a record can carry a secret.
 */
export class MalformedInputError extends Error {
  constructor(
    public readonly record: number,
    public readonly line: number,
    reason: string,
  ) {
    super(`Malformed input: record ${record} (line ${line}) ${reason}.`);
    this.name = "MalformedInputError";
  }
}

const OPENING = new Set(["{", "["]);
const CLOSING = new Set(["}", "]"]);

/** Splits text into the JSON values it holds back to back. */
function parseRecords(text: string): InputRecord[] {
  const records: InputRecord[] = [];
  let line = 1;
  let index = 0;

  while (index < text.length) {
    const char = text[index];
    if (/\s/.test(char)) {
      if (char === "\n") {
        line += 1;
      }
      index += 1;
      continue;
    }

    const recordNumber = records.length + 1;
    const startLine = line;
    if (char !== "{") {
      throw new MalformedInputError(recordNumber, startLine, "is not a JSON object");
    }

    const start = index;
    let depth = 0;
    let inString = false;
    let end = -1;
    for (; index < text.length; index += 1) {
      const current = text[index];
      if (current === "\n") {
        line += 1;
      }
      if (inString) {
        if (current === "\\") {
          index += 1;
        } else if (current === '"') {
          inString = false;
        }
        continue;
      }
      if (current === '"') {
        inString = true;
      } else if (OPENING.has(current)) {
        depth += 1;
      } else if (CLOSING.has(current)) {
        depth -= 1;
        if (depth === 0) {
          end = index + 1;
          index += 1;
          break;
        }
      }
    }
    if (end === -1) {
      throw new MalformedInputError(recordNumber, startLine, "ends before its object closes");
    }

    let value: unknown;
    try {
      value = JSON.parse(text.slice(start, end));
    } catch {
      throw new MalformedInputError(recordNumber, startLine, "is not valid JSON");
    }
    if (!isRecord(value)) {
      throw new MalformedInputError(recordNumber, startLine, "is not a JSON object");
    }
    records.push(value);
  }

  return records;
}

/** Reads every record from `input`, stdin by default. */
export async function readRecords(input: Readable = process.stdin): Promise<InputRecord[]> {
  let text = "";
  input.setEncoding?.("utf8");
  for await (const chunk of input) {
    text += String(chunk);
  }
  return parseRecords(text);
}
