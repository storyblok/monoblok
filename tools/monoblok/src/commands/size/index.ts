import fs from "fs";
import path from "path";
import type { Command } from "commander";
import chalk from "chalk";
import * as utils from "../../utils";
import {
  ACCEPT_LABEL,
  compare,
  describe,
  formatBytes,
  formatDelta,
  hasFailed,
  isChanged,
  measure,
  readMeasurement,
  toMarkdown,
} from "./size";

function fail(error: unknown): void {
  console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
}

export function sizeCommand(program: Command): void {
  const size = program
    .command("size")
    .description("Measure package bundle sizes and compare them with another build");

  size
    .command("measure")
    .description(
      "Measure what a browser downloads for each package export (build the packages first)",
    )
    .argument("[packages...]", "Package names to measure (default: all)")
    .requiredOption("--out <file>", "Write the measurement as JSON")
    .option("--root <dir>", "Root of an installed and built checkout of the repo")
    .action(async (packages: string[], options: { out: string; root?: string }) => {
      try {
        const root = path.resolve(options.root ?? utils.getMonorepoRoot());
        const measurement = await measure(root, packages);
        fs.writeFileSync(options.out, `${JSON.stringify(measurement, null, 2)}\n`);
        for (const [name, measured] of Object.entries(measurement.packages)) {
          if (measured.error) {
            console.log(`${chalk.bold(name)}  ${chalk.red(measured.error)}`);
            continue;
          }
          console.log(chalk.bold(name));
          for (const [entry, measuredEntry] of Object.entries(measured.entries)) {
            const dependencies = measuredEntry.dependencies.join(", ");
            console.log(
              `  ${entry.padEnd(28)} ${formatBytes(measuredEntry.size).padStart(10)}${dependencies ? chalk.dim(`  ${dependencies}`) : ""}`,
            );
          }
        }
        console.log(chalk.green(`\nWrote ${options.out}`));
      } catch (error) {
        fail(error);
      }
    });

  size
    .command("compare")
    .description(
      "Compare a measurement with one of the base build, and fail on growth past the thresholds",
    )
    .argument("<head>", "Measurement of this branch")
    .argument("[base]", "Measurement of the base build; a missing file compares with nothing")
    .option("--base-label <label>", "Name of the base in the report", "base")
    .option("--markdown <file>", "Write the report as Markdown, for a PR comment")
    .option(
      "--accept",
      `Report growth past the thresholds without failing (the \`${ACCEPT_LABEL}\` label)`,
    )
    .action(
      (
        headFile: string,
        baseFile: string | undefined,
        options: { baseLabel: string; markdown?: string; accept?: boolean },
      ) => {
        try {
          const head = readMeasurement(headFile);
          const base = baseFile && fs.existsSync(baseFile) ? readMeasurement(baseFile) : undefined;
          const comparison = compare(head, base);
          const accepted = options.accept ?? false;
          const github = process.env.GITHUB_ACTIONS === "true";

          for (const error of comparison.errors) {
            console.log(chalk.red(`${error.package}: ${error.message}`));
            if (github) {
              console.log(`::error::${error.package}: ${error.message}`);
            }
          }
          for (const change of comparison.changes) {
            if (change.status === "over") {
              const message = describe(change);
              console.log(accepted ? chalk.yellow(message) : chalk.red(message));
              if (github) {
                // GitHub Actions turns workflow commands into annotations on the PR.
                console.log(`::${accepted ? "warning" : "error"}::${message}`);
              }
            } else if (change.kind !== "file" && isChanged(change)) {
              console.log(
                `${change.package} ${change.name}: ${formatDelta(change.size, change.base)}`,
              );
            }
          }

          const markdown = toMarkdown(comparison, options.baseLabel, accepted);
          if (github && process.env.GITHUB_STEP_SUMMARY) {
            fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
          }
          if (options.markdown) {
            fs.writeFileSync(options.markdown, markdown);
          }

          if (hasFailed(comparison, accepted)) {
            const grew = !accepted && comparison.changes.some((change) => change.status === "over");
            console.error(
              chalk.red(
                `\nBundle size check failed.${grew ? ` If the growth is intended, add the \`${ACCEPT_LABEL}\` label to the PR and re-run the failed bundle size job.` : ""}`,
              ),
            );
            process.exitCode = 1;
          }
        } catch (error) {
          fail(error);
        }
      },
    );
}
