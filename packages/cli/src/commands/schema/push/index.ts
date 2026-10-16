import { rm } from "node:fs/promises";
import { confirm } from "@inquirer/prompts";
import { Option } from "commander";

import { colorPalette, commands } from "../../../constants";
import { CommandError, handleError, requireAuthentication, toError } from "../../../utils";
import { getLogger } from "../../../lib/logger/logger";
import { getReporter } from "../../../lib/reporter/reporter";
import { getUI, stderrPromptContext } from "../../../lib/ui";
import { session } from "../../../session";
import { resolvePath } from "../../../utils/filesystem";
import { schemaCommand } from "../command";
import { displayPath } from "../utils";
import type { SchemaPushOptions } from "./constants";
import type { SchemaData } from "../types";
import { loadSchema } from "../load-schema";
import { diffSchema } from "../diff-schema";
import { fetchRemoteSchema, localToNormalized, remoteToNormalized } from "../actions";
import { buildGroupPathByUuid } from "../folders";
import { buildChangesetEntries, executePush, formatDiffOutput } from "./actions";
import { saveChangeset } from "../changeset";
import { analyzeBreakingChanges } from "./migrations/analyze";
import type { ComponentBreakingChanges } from "./migrations/types";
import { renderMigrationCode, toMigrationOps, writeMigrationFile } from "./migrations/generate";
import { writeContentMigration } from "../../migrations/content-migrations";
import { writeLocalComponents } from "./write-local-components";

/** Quotes a path for pasting into a shell when it holds characters the shell would split or expand. */
function shellQuote(path: string): string {
  return /^[\w./:@-]+$/.test(path) ? path : `'${path.replaceAll("'", `'\\''`)}'`;
}

/**
 * The blocks among `names` the space now holds as the local schema defines
 * them, or `undefined` when the space cannot be read.
 */
async function pushedBlocks(
  space: string,
  local: SchemaData,
  names: string[],
): Promise<Set<string> | undefined> {
  try {
    const { remote } = await fetchRemoteSchema(space);
    const diff = diffSchema(remoteToNormalized(remote), localToNormalized(local), {
      compareGroupUuid: true,
    });
    const pending = new Set(
      diff.diffs
        .filter((d) => d.type === "component" && d.action !== "unchanged")
        .map((d) => d.name),
    );
    return new Set(names.filter((name) => !pending.has(name)));
  } catch {
    return undefined;
  }
}

schemaCommand
  .command("push <entry-file>")
  .description("Push local TypeScript schema and datasource definitions to a Storyblok space")
  .option("-s, --space <space>", "space ID")
  .option("-p, --path <path>", "path for file storage")
  .option("--dry-run", "Show diffs without applying changes", false)
  .option("--delete", "Delete remote entities not present in local schema", false)
  .option("--migrations", "Generate scaffold migration files for breaking changes", true)
  .addOption(new Option("--no-migrations", "Skip migration generation for breaking changes"))
  .option(
    "--typed",
    "Generate one defineMigration file for `migrations apply` instead of one .js migration per block for `migrations run`",
  )
  .option("--no-before", "With --typed, skip the .before.ts schema snapshot")
  .option(
    "--write-components",
    "Write component schemas as local JSON files after push (also removes local files for components deleted via --delete)",
    true,
  )
  .addOption(new Option("--no-write-components", "Skip writing local component files"))
  .action(async (entryFile: string, options: SchemaPushOptions, command) => {
    const ui = getUI();
    const logger = getLogger();
    const reporter = getReporter();
    const { space, path: basePath, verbose } = command.optsWithGlobals();
    const { state } = session();

    ui.title(commands.SCHEMA, colorPalette.SCHEMA, "Pushing schema...");
    logger.info("Schema push started", { entryFile, space });

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
    let generatedMigrations: { files: string[]; changes: ComponentBreakingChanges[] } | undefined;
    const runCommand = options.typed ? "migrations apply" : "migrations run";

    try {
      // 1. Load local schema
      const loadSpinner = ui.createSpinner("Resolving schema...");
      let local: SchemaData;
      try {
        local = await loadSchema(entryFile);
      } catch (maybeError) {
        loadSpinner.failed("Failed to resolve schema");
        handleError(toError(maybeError), verbose);
        return;
      }
      loadSpinner.succeed(
        `Found: ${local.components.length} components, ${local.folders.length} folders, ${local.datasources.length} datasources`,
      );

      const totalLocal = local.components.length + local.datasources.length + local.folders.length;
      if (totalLocal === 0) {
        ui.warn(
          "No components, folders, or datasources found in the entry file. Verify the file exports schema definitions.",
        );
        return;
      }

      // 2. Fetch remote state
      const remoteSpinner = ui.createSpinner(`Fetching remote state from space ${space}...`);
      let remoteResult: Awaited<ReturnType<typeof fetchRemoteSchema>>;
      try {
        remoteResult = await fetchRemoteSchema(space);
      } catch (maybeError) {
        remoteSpinner.failed("Failed to fetch remote schema");
        handleError(toError(maybeError), verbose);
        return;
      }
      const { remote, rawComponents, rawComponentFolders, rawDatasources } = remoteResult;
      const migrationTimestamp = new Date().toISOString();

      /** Writes the migrations for `changes` and returns the files written. */
      const writeMigrations = async (changes: ComponentBreakingChanges[]): Promise<string[]> => {
        if (!options.typed) {
          const files: string[] = [];
          for (const comp of changes) {
            const file = await writeMigrationFile({
              spaceId: space,
              componentName: comp.componentName,
              code: renderMigrationCode(comp.changes),
              timestamp: migrationTimestamp,
              basePath: resolvePath(basePath, ""),
            });
            logger.info("Migration generated", {
              component: comp.componentName,
              path: displayPath(file, basePath),
            });
            files.push(file);
          }
          return files;
        }
        const ops = changes.flatMap((comp) => toMigrationOps(comp.componentName, comp.changes));
        if (ops.length === 0) {
          return [];
        }
        const blocks = changes.map((comp) => comp.componentName);
        const written = await writeContentMigration({
          path: basePath,
          space,
          name: `update-${blocks.join("-")}`,
          schemaEntry: entryFile,
          ops,
          before: options.before ? { components: rawComponents, blocks } : undefined,
        });
        const files = [written.migrationPath, written.beforePath].filter(
          (file): file is string => file !== undefined,
        );
        logger.info("Migration generated", {
          components: blocks,
          paths: files.map((file) => displayPath(file, basePath)),
        });
        return files;
      };

      /**
       * The push updates blocks independently, so a failed push can leave some
       * of them updated. Their ops must survive, since a rerun of the push no
       * longer sees their changes, while the ops for the rest are generated again.
       */
      const keepMigrationsForPushedBlocks = async (generated: {
        files: string[];
        changes: ComponentBreakingChanges[];
      }): Promise<void> => {
        const listed = (files: string[]) =>
          files.map((file) => `  - ${displayPath(file, basePath)}`).join("\n");
        const pushed = await pushedBlocks(
          space,
          local,
          generated.changes.map((comp) => comp.componentName),
        );
        if (!pushed) {
          ui.warn(
            `The push failed after these migration files were written:\n${listed(generated.files)}\nThe space could not be read to tell which blocks were pushed. Keep the ops for the blocks the space now holds, delete the others, then run schema push again.`,
          );
          return;
        }
        await Promise.all(generated.files.map((file) => rm(file, { force: true })));
        const pushedChanges = generated.changes.filter((comp) => pushed.has(comp.componentName));
        const files = pushedChanges.length > 0 ? await writeMigrations(pushedChanges) : [];
        if (files.length === 0) {
          ui.warn(
            "The push failed before any block with breaking changes was updated, so no migration was kept. Fix the error and run schema push again.",
          );
          return;
        }
        ui.warn(
          `The push failed, but it updated ${[...pushed].join(", ")}. The migration for them was kept:\n${listed(files)}\nFix the error and run schema push again to generate the migration for the other blocks.`,
        );
      };
      remoteSpinner.succeed(
        `Remote: ${remote.components.size} components, ${remote.datasources.size} datasources`,
      );

      // 3. Diff components, datasources, and folders (component groups).
      // from = remote (base), to = local (target): the diff describes the push.
      // The local DSL opts into group-uuid diffing, so a block that sets
      // `component_group_uuid` explicitly gets its membership pushed.
      const diffResult = diffSchema(remoteToNormalized(remote), localToNormalized(local), {
        compareGroupUuid: true,
      });

      // 5. Display diffs
      ui.br();
      ui.log(formatDiffOutput(diffResult, { delete: options.delete }));

      // 6. Analyze breaking changes and offer migration generation
      if (options.migrations) {
        const breakingChanges = analyzeBreakingChanges(diffResult, local, remote);

        if (breakingChanges.length > 0) {
          const totalChanges = breakingChanges.reduce((sum, c) => sum + c.changes.length, 0);
          ui.br();
          ui.warn(
            `${totalChanges} breaking change(s) detected in ${breakingChanges.length} component(s).`,
          );
          if (!options.typed && !options.before) {
            ui.warn("--no-before has no effect without --typed.");
          }

          // Dry-run: show analysis only, no prompts, no file writes
          if (options.dryRun) {
            ui.info(
              "Without --dry-run, schema push offers to generate a migration for these changes.",
            );
            for (const comp of breakingChanges) {
              for (const change of comp.changes) {
                if (change.kind === "rename") {
                  ui.log(
                    `  Detected rename in '${comp.componentName}': ${change.oldField} → ${change.field}`,
                  );
                }
              }
            }
          } else {
            // Determine if --migrations was explicitly passed (auto-generate) or is just the default (prompt)
            const explicitMigrations = command.getOptionValueSource("migrations") === "cli";
            const shouldGenerate =
              explicitMigrations ||
              (await confirm(
                {
                  message: "Generate migration files for breaking changes?",
                  default: true,
                },
                stderrPromptContext,
              ));

            if (shouldGenerate) {
              // Show detected renames for confirmation, or log them in explicit mode
              for (const comp of breakingChanges) {
                const renames = comp.changes.filter((c) => c.kind === "rename");
                if (renames.length > 0 && explicitMigrations) {
                  for (const r of renames) {
                    if (r.kind === "rename") {
                      ui.log(
                        `  Assumed rename in '${comp.componentName}': ${r.oldField} → ${r.field}`,
                      );
                    }
                  }
                }
                if (renames.length > 0 && !explicitMigrations) {
                  ui.br();
                  ui.log(`Detected renames in '${comp.componentName}':`);
                  for (const r of renames) {
                    if (r.kind === "rename") {
                      ui.log(`  ${r.oldField} → ${r.field}`);
                    }
                  }
                  const renameConfirmed = await confirm(
                    {
                      message: "Are these renames correct?",
                      default: true,
                    },
                    stderrPromptContext,
                  );
                  if (!renameConfirmed) {
                    // Convert renames to separate removals
                    comp.changes = comp.changes.map((c) => {
                      if (c.kind === "rename") {
                        return {
                          kind: "removed" as const,
                          field: c.oldField,
                          renameHint: { newFields: [c.field] },
                        };
                      }
                      return c;
                    });
                  }
                }
              }

              const files = await writeMigrations(breakingChanges);
              for (const file of files) {
                ui.log(`  Generated: ${displayPath(file, basePath)}`);
              }
              if (files.length > 0) {
                generatedMigrations = { files, changes: breakingChanges };
              }
            }
          }
        }
      }

      // Warn about deleted components
      if (options.delete) {
        const deletedComponents = diffResult.diffs.filter(
          (d) => d.type === "component" && d.action === "stale",
        );
        for (const comp of deletedComponents) {
          ui.warn(
            `Component '${comp.name}' will be deleted. Stories using it will have out-of-schema content.`,
          );
        }

        // Warn per stale folder that still holds remote components (they will be
        // ungrouped, not deleted, when the group is removed).
        const staleFolders = diffResult.diffs.filter(
          (d) => d.type === "folder" && d.action === "stale",
        );
        if (staleFolders.length > 0) {
          const uuidByPath = new Map<string, string>();
          for (const [uuid, segments] of buildGroupPathByUuid([
            ...remote.componentFolders.values(),
          ])) {
            uuidByPath.set(segments.join("/"), uuid);
          }
          // Only components that survive the push are truly ungrouped. A stale
          // component inside the folder is being deleted, not ungrouped, so it
          // must not inflate the count.
          const staleComponentNames = new Set(
            diffResult.diffs
              .filter((d) => d.type === "component" && d.action === "stale")
              .map((d) => d.name),
          );
          for (const folder of staleFolders) {
            const uuid = uuidByPath.get(folder.name);
            if (!uuid) {
              continue;
            }
            const count = [...remote.components.values()].filter(
              (c) => c.component_group_uuid === uuid && !staleComponentNames.has(c.name),
            ).length;
            if (count > 0) {
              ui.warn(
                `Folder '${folder.name}' will be deleted; ${count} component(s) inside will be ungrouped.`,
              );
            }
          }
        }
      }

      if (diffResult.stale > 0 && !options.delete) {
        ui.warn(
          `${diffResult.stale} stale entity(s) exist remotely but not in schema. Use --delete to remove.`,
        );
      }

      // 7. Dry run stops here
      if (options.dryRun) {
        ui.info("Dry run — no changes applied.");
        logger.info("Dry run completed", {
          creates: diffResult.creates,
          updates: diffResult.updates,
        });
        return;
      }

      // 8. Save changeset
      const resolvedPath = resolvePath(basePath, "");
      const timestamp = new Date().toISOString();

      const changesetPath = await saveChangeset(resolvedPath, {
        timestamp,
        spaceId: Number(space),
        remote: {
          components: rawComponents,
          componentFolders: rawComponentFolders,
          datasources: rawDatasources,
        },
        changes: buildChangesetEntries(diffResult, local, remote, { delete: options.delete }),
      });
      logger.info("Changeset saved", { path: displayPath(changesetPath, basePath) });

      // 9. Execute push (skipped when nothing to push).
      const nothingToPush =
        diffResult.creates === 0 &&
        diffResult.updates === 0 &&
        (!options.delete || diffResult.stale === 0);
      let pushResult: Awaited<ReturnType<typeof executePush>> | null = null;
      if (!nothingToPush) {
        const pushSpinner = ui.createSpinner("Pushing schema...");
        try {
          pushResult = await executePush(space, local, remote, diffResult, {
            delete: options.delete,
          });
        } catch (error) {
          pushSpinner.failed("Failed to push schema");
          if (generatedMigrations) {
            await keepMigrationsForPushedBlocks(generatedMigrations);
          }
          throw error;
        }

        summary.total = pushResult.created + pushResult.updated + pushResult.deleted;
        summary.succeeded = summary.total;

        pushSpinner.succeed(
          `Pushed ${pushResult.created} creations, ${pushResult.updated} updates${pushResult.deleted > 0 ? `, ${pushResult.deleted} deletions` : ""}.`,
        );

        if (generatedMigrations) {
          ui.info(
            `Generated migrations are scaffolds. Review and adjust them before running \`storyblok ${runCommand}\`.`,
          );
          const pathFlag = basePath ? ` --path ${shellQuote(basePath)}` : "";
          ui.info(`Run migrations when ready: storyblok ${runCommand} --space ${space}${pathFlag}`);
        }

        // Block tags are a dependency of the blocks that name them rather than a
        // diffed entity, so a created tag never appears in the diff output above.
        // Report it here so the space gaining a tag is not silent.
        if (pushResult.createdTags > 0) {
          ui.info(
            `Created ${pushResult.createdTags} block tag(s) the target space did not have yet.`,
          );
        }
      }

      // 10. Write local component files (keeps disk in sync with intended schema state,
      // even when nothing was pushed — so a fresh checkout on an already-in-sync space
      // can still run `stories push` without an extra `components pull` step).
      if (options.writeComponents) {
        try {
          await writeLocalComponents({
            space,
            basePath,
            resolved: local,
            diffResult,
            deleteRemoved: options.delete,
            ui,
            logger,
          });
        } catch (writeError) {
          ui.warn(`Failed to write local component files: ${toError(writeError).message}`);
          logger.warn("Failed to write local component files", {
            error: toError(writeError).message,
          });
        }
      }

      // 11. Confirm the outcome last, so a run that only surfaced advisory
      // warnings does not read as a failure.
      ui.br();
      if (pushResult) {
        ui.ok(
          `Schema pushed to space ${space}. ${pushResult.created} created, ${pushResult.updated} updated${pushResult.deleted > 0 ? `, ${pushResult.deleted} deleted` : ""}.`,
          true,
        );
      } else {
        ui.ok(`Schema already up to date with space ${space}, nothing to push.`, true);
      }
      ui.br();
    } catch (maybeError) {
      summary.failed += 1;
      handleError(toError(maybeError), verbose);
    } finally {
      logger.info("Schema push finished", { summary });
      reporter.addSummary("schemaPushResults", summary);
      reporter.finalize();
    }
  });
