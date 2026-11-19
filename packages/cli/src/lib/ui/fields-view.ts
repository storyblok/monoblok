import chalk from "chalk";
import { sanitize } from "./table";

const GAP = "  ";

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (Array.isArray(value) && value.every((item) => typeof item !== "object")) {
    return value.join(", ");
  }
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

/**
 * One record as a field/value list, for a single resource on a terminal where
 * a one-row table would be too wide to read.
 */
export function renderFields(record: Record<string, unknown>): string {
  const entries = Object.entries(record);
  const width = Math.max(0, ...entries.map(([field]) => field.length));
  return entries
    .map(
      ([field, value]) =>
        `${chalk.bold(sanitize(field).padEnd(width))}${GAP}${sanitize(formatValue(value))}`,
    )
    .join("\n");
}
