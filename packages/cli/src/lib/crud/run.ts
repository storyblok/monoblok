// The write loop shared by `create`, `update` and `delete`: one record at a
// time, a result line per record that went through, an error per record that
// did not, and a summary at the end. A failing record does not stop the run; it
// makes the run exit 1. A rejected access token stops it.

import { getLogger } from "../logger/logger";
import { getReporter } from "../reporter/reporter";
import { createResultOutput } from "../pipe";
import type { MachineOutput } from "../pipe";
import { getStderrTarget, getUI } from "../ui";
import type { TableColumn } from "../ui";
import { reportError, stopsBatch, toCrudError } from "./errors";
import type { SecretScrubber } from "./redact";
import type { ResultLine } from "../pipe";
import type { CrudOperations, Noun } from "./types";
import { isRecord } from "../../utils/object";

/** Writes values to stdout, as JSONL or a table, and waits for a slow reader. */
export type ResultWriter<T> = {
  write: (value: T) => Promise<void>;
  end: () => Promise<void>;
};

export function createResultWriter<T>(columns: TableColumn<T>[]): ResultWriter<T> {
  const output: MachineOutput = createResultOutput({ columns });
  return {
    write: (value) =>
      new Promise<void>((resolve, reject) => {
        output.sink.write(value, (error) => (error ? reject(error) : resolve()));
      }),
    end: async () => {
      await new Promise<void>((resolve) => output.sink.end(resolve));
      await output.flush();
      output.close();
    },
  };
}

const formatValue = (value: unknown): string =>
  value === null || value === undefined ? "–" : typeof value === "string" ? value : JSON.stringify(value);

const describeChange = ([field, change]: [string, unknown]): string =>
  isRecord(change) ? `${field}: ${formatValue(change.from)} → ${formatValue(change.to)}` : `${field}: ${String(change)}`;

const describeResult = (line: ResultLine): string => {
  if (line._reason) {
    return line._reason.replace("_", " ");
  }
  return Object.entries(line._diff ?? {})
    .map(describeChange)
    .join("; ");
};

const RESULT_COLUMNS: TableColumn<ResultLine>[] = [
  { header: "Action", value: (line) => (line._dry_run ? `${line.action} (dry run)` : line.action) },
  { header: "ID", value: (line) => (line.id === null ? "" : String(line.id)) },
  { header: "Name", value: (line) => String(line.name ?? ""), flexible: true },
  { header: "Details", value: describeResult },
];

const PAST_TENSE = { create: "Created", update: "Updated", delete: "Deleted" } as const;

/** One record of a batch: where it came from, for errors, and its input line if piped. */
export type BatchItem<T> = {
  /** Position in the input, counted from 1. Unset for a target named on the command line. */
  line?: number;
  value: T;
};

export type BatchContext = {
  /** The record's ID, once known, so a failure can name it. */
  id?: number;
};

/**
 * Adds the values a field accepts to a 422 on that field, so a caller sees
 * what to send instead without another command.
 */
async function withAllowedValues(maybeError: unknown, operations: CrudOperations) {
  const error = toCrudError(maybeError);
  const lookups = operations.allowedValues;
  if (error.status !== 422 || !error.details || !lookups) {
    return error;
  }
  const allowed: Record<string, string[]> = {};
  for (const field of Object.keys(error.details)) {
    const lookup = lookups[field];
    if (!lookup) {
      continue;
    }
    try {
      allowed[field] = await lookup();
    } catch {
      // The values only help; the API's own error is what the caller needs.
    }
  }
  if (Object.keys(allowed).length > 0) {
    error.details.allowed_values = allowed;
  }
  return error;
}

export async function runBatch<T>({
  verb,
  noun,
  items,
  dryRun,
  operations,
  scrubber,
  handle,
}: {
  verb: "create" | "update" | "delete";
  noun: Noun;
  items: BatchItem<T>[];
  dryRun: boolean;
  operations: CrudOperations;
  scrubber: SecretScrubber;
  handle: (item: BatchItem<T>, context: BatchContext) => Promise<ResultLine>;
}): Promise<void> {
  const ui = getUI();
  const logger = getLogger();
  const writer = createResultWriter(RESULT_COLUMNS);
  let done = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of items) {
    const context: BatchContext = {};
    try {
      const result = await handle(item, context);
      // Result lines carry no field values beyond ID and name, and a diff marks a
      // secret only as changed, so they are written unscrubbed.
      await writer.write(dryRun ? { ...result, _dry_run: true } : result);
      logger.info(`${noun.singular} ${result.action}`, {
        id: result.id,
        dryRun,
        reason: result._reason,
      });
      if (result._skipped) {
        skipped += 1;
      } else {
        done += 1;
      }
    } catch (maybeError) {
      failed += 1;
      const error = await withAllowedValues(maybeError, operations);
      reportError(error, { scrubber, line: item.line, id: context.id });
      if (stopsBatch(error)) {
        break;
      }
    }
  }
  await writer.end();

  const count = (n: number) => `${n} ${n === 1 ? noun.singular : noun.plural}`;
  const parts = [
    dryRun ? `Would ${verb} ${count(done)} (dry run)` : `${PAST_TENSE[verb]} ${count(done)}`,
    skipped > 0 && `skipped ${skipped}`,
    failed > 0 && `failed ${failed}`,
  ].filter(Boolean);
  // On a terminal only: a program reading stderr gets error lines and nothing else.
  if (getStderrTarget() === "terminal") {
    ui.info(`${parts.join(", ")}.`);
  }

  getReporter()
    .addSummary(`${verb}Results`, { total: items.length, succeeded: done, skipped, failed })
    .finalize();
}
