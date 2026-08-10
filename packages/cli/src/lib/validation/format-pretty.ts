import chalk from "chalk";
import type { LevelOption, ValidationRunResult } from "./types";
import { countIssues, filterIssuesByLevel } from "./filter";

const SYMBOL = {
  error: chalk.red("✖"),
  warning: chalk.yellow("⚠"),
} as const;

function pluralize(count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

/**
 * Renders a validation run as human-readable text. Groups are printed with a
 * header and indented issue lines; a summary line closes the output. The summary
 * always reports true totals — `level` only filters which issue lines appear.
 *
 * True totals over a filtered listing read as a contradiction (warnings counted
 * that were never shown, an affected-unit count above the number of groups
 * printed), so the summary says outright what the threshold withheld.
 */
export function formatPretty(result: ValidationRunResult, level: LevelOption): string {
  const lines: string[] = [];

  for (const group of result.groups) {
    const visible = filterIssuesByLevel(group.issues, level);
    if (visible.length === 0) {
      continue;
    }
    lines.push(group.header);
    const codeWidth = Math.max(...visible.map((issue) => issue.code.length));
    for (const issue of visible) {
      const location =
        issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message;
      lines.push(`  ${SYMBOL[issue.severity]} ${issue.code.padEnd(codeWidth)}   ${location}`);
    }
  }

  const { errors, warnings, unitsWithIssues } = countIssues(result);
  const summarySymbol =
    errors > 0 ? chalk.red("✖") : warnings > 0 ? chalk.yellow("⚠") : chalk.green("✔");
  // Errors and warnings are pluralized, so a plural unit noun next to a count of
  // one reads as an oversight: `1 error, 0 warnings across 1 of 1 stories`.
  const unitNoun = result.unitsTotal === 1 ? result.unitNounSingular : result.unitNoun;
  const hidden =
    level === "error" && warnings > 0
      ? chalk.dim(` (${pluralize(warnings, "warning")} hidden by --level error)`)
      : "";
  lines.push(
    `${summarySymbol} ${pluralize(errors, "error")}, ${pluralize(warnings, "warning")} ` +
      `across ${unitsWithIssues} of ${result.unitsTotal} ${unitNoun}${hidden}`,
  );

  return lines.join("\n");
}
