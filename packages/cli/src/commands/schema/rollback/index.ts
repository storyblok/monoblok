import { confirm, select } from "@inquirer/prompts";
import { basename } from "pathe";

import { colorPalette, commands } from "../../../constants";
import { CommandError, handleError, requireAuthentication, toError } from "../../../utils";
import { getLogger } from "../../../lib/logger/logger";
import { getReporter } from "../../../lib/reporter/reporter";
import { getUI, stderrPromptContext } from "../../../lib/ui";
import { session } from "../../../session";
import { resolvePath } from "../../../utils/filesystem";
import { schemaCommand } from "../command";
import { fetchRemoteSchema } from "../actions";
import { saveChangeset } from "../changeset";
import { displayPath } from "../utils";
import type { SchemaRollbackOptions } from "./constants";
import {
  buildRollbackChangesetEntries,
  buildRollbackOps,
  executeRollback,
  findRollbackCandidates,
  findUnrestorableEntries,
  formatRollbackOutput,
  loadChangeset,
  resolveRollbackOps,
} from "./actions";

schemaCommand
  .command("rollback [changeset-file]")
  .description("Roll back a Storyblok space to the state captured in a changeset")
  .option("-s, --space <space>", "space ID")
  .option("--dry-run", "Show what would be undone without applying changes", false)
  .option("--yes", "Skip confirmation prompt", false)
  .option(
    "--latest",
    "Automatically select the most recent changeset with changes for the space",
    false,
  )
  .action(async (changesetFile: string | undefined, options: SchemaRollbackOptions, command) => {
    const ui = getUI();
    const logger = getLogger();
    const reporter = getReporter();
    const { space, path: basePath, verbose } = command.optsWithGlobals();
    const { state } = session();

    ui.title(commands.SCHEMA, colorPalette.SCHEMA, "Rolling back schema...");
    logger.info("Schema rollback started", { changesetFile, space });

    if (!requireAuthentication(state, verbose)) {
      return;
    }

    if (!space) {
      handleError(
        new CommandError("Please provide the space as argument --space SPACE_ID."),
        verbose,
      );
      return;
    }

    const summary = { total: 0, succeeded: 0, failed: 0 };

    try {
      // 1. Resolve changeset file
      const resolvedBase = resolvePath(basePath, "");
      const spaceId = Number(space);
      const noCandidatesMessage = `No changesets with changes found for space ${space}. Run \`schema push\` first to create one.`;
      const candidates = findRollbackCandidates(resolvedBase, spaceId, (path) => {
        ui.warn(`Skipped ${basename(path)}: not a readable schema changeset.`);
      });
      let resolvedFile: string;

      if (changesetFile) {
        resolvedFile = changesetFile;
      } else if (options.latest) {
        const { value: latest } = await candidates.next();
        if (!latest) {
          ui.warn(noCandidatesMessage);
          return;
        }
        resolvedFile = latest.path;
        ui.info(`Using latest changeset: ${basename(resolvedFile)}`);
      } else {
        const choices = [];
        for await (const { path, changeset } of candidates) {
          choices.push({
            name: `${basename(path)} (${changeset.changes.length} change(s))`,
            value: path,
          });
        }
        if (choices.length === 0) {
          ui.warn(noCandidatesMessage);
          return;
        }
        resolvedFile = await select(
          { message: "Select a changeset to roll back:", choices },
          stderrPromptContext,
        );
      }

      // 2. Load changeset
      let changeset;
      try {
        changeset = await loadChangeset(resolvedFile);
      } catch (maybeError) {
        handleError(toError(maybeError), verbose);
        return;
      }

      logger.info("Changeset loaded", { file: resolvedFile, changes: changeset.changes.length });

      const changesetName = displayPath(resolvedFile, basePath);
      if (changeset.spaceId !== spaceId) {
        handleError(
          new CommandError(
            `${changesetName} was recorded for space ${changeset.spaceId}, not space ${space}.`,
          ),
          verbose,
        );
        return;
      }

      const unrestorable = findUnrestorableEntries(changeset);
      if (unrestorable.length > 0) {
        const names = unrestorable.map((entry) => `${entry.type} '${entry.name}'`).join(", ");
        handleError(
          new CommandError(
            `Cannot roll back ${changesetName}: it does not record the state to restore for ${names}. Rollbacks made with earlier CLI versions saved changesets without it. Pass another changeset file, or delete this one.`,
          ),
          verbose,
        );
        return;
      }

      // 3. Build rollback ops
      const ops = buildRollbackOps(changeset);

      if (ops.length === 0) {
        ui.ok("Changeset has no changes — nothing to roll back.");
        return;
      }

      // 4. Display diff
      ui.br();
      ui.log(formatRollbackOutput(changeset.changes));

      // 5. Dry run stops here
      if (options.dryRun) {
        ui.info("Dry run — no changes applied.");
        logger.info("Dry run completed", { ops: ops.length });
        return;
      }

      // 6. Confirm (unless --yes)
      if (!options.yes) {
        const confirmed = await confirm(
          {
            message: `Apply rollback of ${ops.length} change(s) from ${basename(resolvedFile)}?`,
            default: false,
          },
          stderrPromptContext,
        );
        if (!confirmed) {
          ui.info("Rollback cancelled.");
          return;
        }
      }

      // 7. Fetch current remote state (needed for entity IDs)
      const remoteSpinner = ui.createSpinner(
        `Fetching current remote state from space ${space}...`,
      );
      let remoteResult;
      try {
        remoteResult = await fetchRemoteSchema(space);
      } catch (maybeError) {
        remoteSpinner.failed("Failed to fetch remote schema");
        handleError(toError(maybeError), verbose);
        return;
      }
      const { remote } = remoteResult;
      remoteSpinner.succeed(
        `Remote: ${remote.components.size} components, ${remote.componentFolders.size} component folders, ${remote.datasources.size} datasources`,
      );

      // 8. Resolve the ops against the live space
      const resolved = resolveRollbackOps(ops, remote);
      if (resolved.skipped.length > 0) {
        const names = resolved.skipped.map((op) => `${op.type} '${op.name}'`).join(", ");
        ui.info(`Skipped ${resolved.skipped.length} change(s), no longer in the space: ${names}.`);
      }
      const rollbackEntries = buildRollbackChangesetEntries(resolved.ops, remote);
      if (rollbackEntries.length === 0) {
        ui.ok("The space already matches the changeset — nothing to roll back.");
        return;
      }

      // 9. Save the rollback changeset before applying, so a rollback failing midway can be rolled back.
      const rollbackChangesetPath = await saveChangeset(resolvedBase, {
        timestamp: new Date().toISOString(),
        spaceId,
        remote: {
          components: remoteResult.rawComponents,
          componentFolders: remoteResult.rawComponentFolders,
          datasources: remoteResult.rawDatasources,
        },
        changes: rollbackEntries,
      });
      logger.info("Rollback changeset saved", {
        path: displayPath(rollbackChangesetPath, basePath),
      });

      // 10. Execute rollback
      const rollbackSpinner = ui.createSpinner("Applying rollback...");
      let result: Awaited<ReturnType<typeof executeRollback>>;
      try {
        result = await executeRollback(space, resolved.ops, remote);
      } catch (error) {
        rollbackSpinner.failed("Failed to apply rollback");
        throw error;
      }

      summary.total = result.created + result.updated + result.deleted;
      summary.succeeded = summary.total;

      rollbackSpinner.succeed(
        `Rolled back: ${result.created} created, ${result.updated} updated, ${result.deleted} deleted.`,
      );
    } catch (maybeError) {
      summary.failed += 1;
      handleError(toError(maybeError), verbose);
    } finally {
      logger.info("Schema rollback finished", { summary });
      reporter.addSummary("schemaRollbackResults", summary);
      reporter.finalize();
    }
  });
