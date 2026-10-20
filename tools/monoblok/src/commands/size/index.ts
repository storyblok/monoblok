import fs from "fs";
import path from "path";
import { Command } from "commander";
import chalk from "chalk";
import * as utils from "../../utils";
import {
  CONFIG_FILE,
  checkProject,
  describe,
  formatBytes,
  formatChange,
  loadProjects,
  toMarkdown,
  updateBaselines,
  type SizeStatus,
} from "./size";

const STATUS_COLOR: Record<SizeStatus, (text: string) => string> = {
  ok: chalk.green,
  warn: chalk.yellow,
  error: chalk.red,
  shrunk: chalk.cyan,
  missing: chalk.red,
};

// GitHub Actions turns these workflow commands into annotations on the PR.
const ANNOTATION: Partial<Record<SizeStatus, string>> = {
  warn: "warning",
  error: "error",
  shrunk: "notice",
  missing: "error",
};

export function sizeCommand(program: Command): void {
  const size = program
    .command("size")
    .description(`Check package bundle sizes against the baselines in each ${CONFIG_FILE}`);

  size
    .command("check")
    .description("Compare the gzipped build output with the baseline (build the packages first)")
    .argument("[packages...]", "Package names to check (default: all)")
    .action((packages: string[]) => {
      try {
        const root = utils.getMonorepoRoot();
        const results = loadProjects(root, packages).map((project) => checkProject(root, project));
        const github = process.env.GITHUB_ACTIONS === "true";

        for (const result of results) {
          console.log(chalk.bold(result.name));
          for (const entry of result.entries) {
            const color = STATUS_COLOR[entry.status];
            console.log(
              `  ${entry.pattern.padEnd(32)} ${formatBytes(entry.size).padStart(10)}  ${formatChange(entry.change).padStart(7)}  ${color(entry.status)}`,
            );
            if (entry.status !== "ok") {
              console.log(color(`    ${describe(result, entry)}`));
            }
            const annotation = ANNOTATION[entry.status];
            if (github && annotation) {
              const file = path.join(result.dir, CONFIG_FILE);
              console.log(`::${annotation} file=${file}::${describe(result, entry)}`);
            }
          }
        }

        if (github && process.env.GITHUB_STEP_SUMMARY) {
          fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, toMarkdown(results));
        }

        const failed = results.some((result) =>
          result.entries.some((entry) => entry.status === "error" || entry.status === "missing"),
        );
        if (failed) {
          console.error(chalk.red("\nBundle size check failed."));
          process.exitCode = 1;
        }
      } catch (error) {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exitCode = 1;
      }
    });

  size
    .command("update")
    .description(`Write the current gzipped sizes to ${CONFIG_FILE} as the new baselines`)
    .argument("[packages...]", "Package names to update (default: all)")
    .action((packages: string[]) => {
      try {
        const root = utils.getMonorepoRoot();
        for (const project of loadProjects(root, packages)) {
          const config = updateBaselines(root, project);
          fs.writeFileSync(
            path.join(root, project.dir, CONFIG_FILE),
            `${JSON.stringify(config, null, 2)}\n`,
          );
          console.log(chalk.green(`Updated ${path.join(project.dir, CONFIG_FILE)}`));
        }
      } catch (error) {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exitCode = 1;
      }
    });
}
