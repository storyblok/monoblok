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
import type { BreakingChange, ComponentBreakingChanges } from "./migrations/types";
import { applyDeclaredRenames } from "./migrations/declared-renames";
import {
  migrationTitle,
  renderMigrationCode,
  toMigrationOps,
  writeMigrationFile,
} from "./migrations/generate";
import { writeContentMigration } from "../../migrations/content-migrations";
import { writeLocalComponents } from "./write-local-components";
import { detectBlockRenames, withBlockRenames } from "./block-renames";
import type { BlockRename } from "./block-renames";
import {
  countStoriesUsing,
  describeFolder,
  foldersNaming,
  renameFolderRestrictions,
} from "./story-folders";
import { plural } from "../../migrations/content-migrations";

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

/** Splits `a:b` into its two names, or `undefined` when either is missing. */
function pairOf(value: string): [string, string] | undefined {
  const [from, to, ...rest] = value.split(":");
  return from && to && rest.length === 0 ? [from, to] : undefined;
}

/** Quotes a path for pasting into a shell when it holds characters the shell would split or expand. */
function shellQuote(path: string): string {
  return /^[\w./:@-]+$/.test(path) ? path : `'${path.replaceAll("'", `'\\''`)}'`;
}

/**
 * The blocks among `names` the space now holds as the local schema defines
 * them, or `undefined` when the space cannot be read.
 */
const describeRename = ({ from, to }: BlockRename): string => `${from} → ${to}`;

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
  .option("--dry-run", "Show diffs without applying changes", false)
  .option("--delete", "Delete remote entities not present in local schema", false)
  .option("--force", "With --delete, delete blocks that stories still use", false)
  .option(
    "-y, --yes",
    "Accept every block and field rename schema push detects without asking",
    false,
  )
  .option(
    "--rename <block.field:new-field>",
    "Rename a field of a block in the generated migration (repeatable)",
    collect,
    [],
  )
  .option(
    "--rename-block <block:new-block>",
    "Rename a block in place instead of creating a new one (repeatable)",
    collect,
    [],
  )
  .option("--no-renames", "Treat detected renames as removals and new blocks or fields")
  .option(
    "--migrations",
    "Generate migration files for breaking changes without asking, taking detected field renames as given",
  )
  .addOption(new Option("--no-migrations", "Skip migration generation for breaking changes"))
  .option("--typed", "Generate one defineMigration file instead of one .js migration per block")
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
    const runCommand = "migrations run";

    /**
     * Without a terminal, questions are collected instead of asked, so a script
     * or CI run never waits on a prompt, and `failOnUnanswered` names all of
     * them at once before anything is written. Until then each one counts as
     * accepted, so the questions that follow from it are collected too.
     */
    const unanswered: string[] = [];
    const ask = async (message: string, flags: string): Promise<boolean> => {
      if (!process.stdin.isTTY) {
        unanswered.push(`${message} ${flags}`);
        return true;
      }
      return confirm({ message, default: true }, stderrPromptContext);
    };
    const failOnUnanswered = (): void => {
      if (unanswered.length === 0) return;
      const needs =
        unanswered.length === 1
          ? "an answer to 1 question"
          : `answers to ${unanswered.length} questions`;
      throw new CommandError(
        `schema push needs ${needs}, but stdin is not a terminal:\n${unanswered.map((question) => `  - ${question}`).join("\n")}`,
      );
    };

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
      const { rawComponents, rawComponentFolders, rawDatasources } = remoteResult;
      let { remote } = remoteResult;
      const migrationTimestamp = new Date().toISOString();

      /** The name the block has in the space before the push, which a migration addresses it by. */
      const blockBefore = (comp: ComponentBreakingChanges): string =>
        comp.changes.find((change) => change.kind === "block_renamed")?.from ?? comp.componentName;

      const writeMigrations = async (changes: ComponentBreakingChanges[]): Promise<string[]> => {
        if (!options.typed) {
          const files: string[] = [];
          for (const comp of changes) {
            const file = await writeMigrationFile({
              spaceId: space,
              componentName: blockBefore(comp),
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
        const ops = changes.flatMap((comp) => toMigrationOps(blockBefore(comp), comp.changes));
        if (ops.length === 0) {
          return [];
        }
        const blocks = changes.map((comp) => comp.componentName);
        const written = await writeContentMigration({
          path: basePath,
          space,
          name: `update-${blocks.join("-")}`,
          title: migrationTitle(changes, blockBefore),
          schemaEntry: entryFile,
          ops,
          before: options.before
            ? { components: rawComponents, blocks: changes.map(blockBefore) }
            : undefined,
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
      const keepMigrationsForPushedBlocks = async (
        generated: { files: string[]; changes: ComponentBreakingChanges[] },
        pushed: ReadonlySet<string> | undefined,
      ): Promise<void> => {
        const listed = (files: string[]) =>
          files.map((file) => `  - ${displayPath(file, basePath)}`).join("\n");
        if (!pushed) {
          ui.warn(
            `The push failed after these migration files were written:\n${listed(generated.files)}\nThe space could not be read to tell which blocks were pushed. Keep the ops for the blocks the push already updated, delete the rest, then run schema push again.`,
          );
          return;
        }
        const pushedChanges = generated.changes.filter((comp) => pushed.has(comp.componentName));
        // Write the kept ops before removing anything, so a failed write loses no ops.
        const files =
          pushedChanges.length === generated.changes.length
            ? generated.files
            : pushedChanges.length > 0
              ? await writeMigrations(pushedChanges)
              : [];
        const kept = new Set(files);
        await Promise.all(
          generated.files
            .filter((file) => !kept.has(file))
            .map((file) => rm(file, { force: true })),
        );
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
      /**
       * Folders name their default and allowed content types by block name, so
       * a renamed block would leave them pointing at a name no block has, and
       * editors could no longer create stories there.
       */
      const updateFolderRestrictions = async (
        renames: readonly BlockRename[],
        deleted: readonly string[],
      ): Promise<void> => {
        if (renames.length === 0 && deleted.length === 0) return;
        try {
          const renamedFrom = new Set(renames.map((rename) => rename.from));
          const folders = await foldersNaming(space, new Set([...renamedFrom, ...deleted]));
          const renamedFolders = folders.filter((folder) =>
            [folder.defaultRoot, ...folder.contentTypes].some(
              (name) => name !== undefined && renamedFrom.has(name),
            ),
          );
          await renameFolderRestrictions(space, renamedFolders, renames);
          logger.info("Folder content types updated", {
            renames: renames.map(describeRename),
            folders: renamedFolders.map(describeFolder),
          });
          if (renamedFolders.length > 0) {
            ui.info(
              `Updated the content types of ${plural(renamedFolders.length, "folder", "folders")} to the renamed blocks: ${renamedFolders.map(describeFolder).join(", ")}.`,
            );
          }
          for (const folder of folders) {
            const names = [folder.defaultRoot, ...folder.contentTypes].filter(
              (name): name is string => name !== undefined && deleted.includes(name),
            );
            if (names.length > 0) {
              ui.warn(
                `Folder ${describeFolder(folder)} still names the deleted ${[...new Set(names)].join(", ")} as a content type. Update it in the Storyblok UI.`,
              );
            }
          }
        } catch (maybeError) {
          const { message } = toError(maybeError);
          logger.warn("Failed to update folder content types", {
            renames: renames.map(describeRename),
            error: message,
          });
          ui.warn(
            `The folders that name renamed or deleted blocks as content types could not be updated: ${message}`,
          );
        }
      };

      remoteSpinner.succeed(
        `Remote: ${remote.components.size} components, ${remote.datasources.size} datasources`,
      );

      // 3. Diff components, datasources, and folders (component groups).
      // from = remote (base), to = local (target): the diff describes the push.
      // The local DSL opts into group-uuid diffing, so a block that sets
      // `component_group_uuid` explicitly gets its membership pushed.
      const declaredRenames = new Map(
        options.rename.map((value) => {
          const pair = pairOf(value);
          const dot = pair?.[0].indexOf(".") ?? -1;
          if (!pair || dot <= 0) {
            throw new CommandError(
              `Invalid --rename "${value}". Use --rename block.field:new-field.`,
            );
          }
          return [
            pair[0],
            { block: pair[0].slice(0, dot), field: pair[0].slice(dot + 1), to: pair[1] },
          ];
        }),
      );

      const diff = () =>
        diffSchema(remoteToNormalized(remote), localToNormalized(local), {
          compareGroupUuid: true,
        });
      let diffResult = diff();

      // 4. Pair blocks only the space has with blocks only the schema has, so
      // a confirmed rename updates the block in place instead of creating a
      // new block and leaving the stories on a stale one.
      const blockRenames: BlockRename[] = [];
      const storyCounts = new Map<string, number | undefined>();
      const storiesUsing = async (block: string): Promise<number | undefined> => {
        if (!storyCounts.has(block)) storyCounts.set(block, await countStoriesUsing(space, block));
        return storyCounts.get(block);
      };
      const usage = (count: number | undefined) =>
        count === undefined ? "" : ` (${plural(count, "story", "stories")})`;
      const declaredBlockRenames = options.renameBlock.map((value) => {
        const pair = pairOf(value);
        if (!pair) {
          throw new CommandError(`Invalid --rename-block "${value}". Use --rename-block old:new.`);
        }
        return { from: pair[0], to: pair[1] };
      });
      const detectedBlockRenames = detectBlockRenames(diffResult, local, remote);
      for (const declared of declaredBlockRenames) {
        const actionOf = (name: string) =>
          diffResult.diffs.find((d) => d.type === "component" && d.name === name)?.action;
        if (actionOf(declared.from) !== "stale" || actionOf(declared.to) !== "create") {
          throw new CommandError(
            `--rename-block ${declared.from}:${declared.to} needs a block ${declared.from} that only the space has and a block ${declared.to} that only the schema has.`,
          );
        }
        blockRenames.push(declared);
      }
      for (const rename of detectedBlockRenames) {
        if (
          blockRenames.some(
            (declared) => declared.from === rename.from || declared.to === rename.to,
          )
        ) {
          continue;
        }
        const stories = usage(await storiesUsing(rename.from));
        if (!options.renames) {
          continue;
        }
        if (options.dryRun) {
          ui.info(
            `Possible block rename: ${rename.from} → ${rename.to}${stories}. Pass --rename-block ${rename.from}:${rename.to} to rename it in place, or --no-renames to create ${rename.to} as a new block.`,
          );
          continue;
        }
        const confirmed =
          options.yes ||
          (await ask(
            `Rename block ${rename.from} → ${rename.to}${stories}? Otherwise ${rename.to} is created as a new block.`,
            `Pass --yes or --rename-block ${rename.from}:${rename.to} to rename it, or --no-renames to create ${rename.to} as a new block.`,
          ));
        if (confirmed) blockRenames.push(rename);
      }
      if (blockRenames.length > 0) {
        remote = withBlockRenames(remote, blockRenames);
        diffResult = diff();
      }

      // Deleting a block stories still use leaves their content without a
      // schema, so it takes --force.
      if (options.delete) {
        const used: string[] = [];
        for (const d of diffResult.diffs) {
          if (d.type !== "component" || d.action !== "stale") continue;
          const count = await storiesUsing(d.name);
          if (count) used.push(`${d.name}${usage(count)}`);
        }
        if (used.length > 0 && !options.force) {
          const message = `Stories still use ${used.length === 1 ? "this block" : "these blocks"}, which --delete would delete: ${used.join(", ")}. Rename the block, migrate its content first, or pass --force to delete it anyway.`;
          if (!options.dryRun) {
            throw new CommandError(message);
          }
          ui.warn(message);
        }
      }

      // 5. Display diffs
      ui.br();
      ui.log(formatDiffOutput(diffResult, { delete: options.delete }));

      // 6. Analyze breaking changes and offer migration generation
      if (options.migrations !== false) {
        const breakingChanges = analyzeBreakingChanges(diffResult, local, remote);
        for (const { from, to } of blockRenames) {
          let entry = breakingChanges.find((comp) => comp.componentName === to);
          if (!entry) {
            entry = { componentName: to, changes: [] };
            breakingChanges.push(entry);
          }
          // Last, so the field ops before it address the block by its old name.
          entry.changes.push({ kind: "block_renamed", from, to });
        }
        applyDeclaredRenames(breakingChanges, declaredRenames);

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
              "Without --dry-run, schema push asks whether to generate a migration for these changes. Pass --migrations to generate it without asking, or --no-migrations to skip it.",
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
            // --migrations generates without asking, and has always taken
            // detected field renames as given.
            const explicitMigrations = command.getOptionValueSource("migrations") === "cli";
            const shouldGenerate =
              explicitMigrations ||
              options.yes ||
              (await ask(
                "Generate migration files for breaking changes?",
                "Pass --migrations to generate them, which also takes detected field renames as given, or --no-migrations to skip them.",
              ));

            if (shouldGenerate) {
              for (const comp of breakingChanges) {
                const kept: BreakingChange[] = [];
                for (const change of comp.changes) {
                  if (
                    change.kind !== "rename" ||
                    declaredRenames.has(`${comp.componentName}.${change.oldField}`)
                  ) {
                    kept.push(change);
                    continue;
                  }
                  const label = `${comp.componentName}.${change.oldField} → ${change.field}`;
                  const confirmed =
                    options.renames &&
                    (explicitMigrations ||
                      options.yes ||
                      (await ask(
                        `Rename field ${label}? Otherwise ${change.oldField} is removed and ${change.field} added.`,
                        `Pass --yes or --rename ${comp.componentName}.${change.oldField}:${change.field} to rename it, or --no-renames to remove ${change.oldField}.`,
                      )));
                  if (confirmed && explicitMigrations && !options.yes) {
                    ui.log(`  Assumed rename: ${label}`);
                  }
                  kept.push(
                    confirmed
                      ? change
                      : {
                          kind: "removed",
                          field: change.oldField,
                          renameHint: { newFields: [change.field] },
                        },
                  );
                }
                comp.changes = kept;
              }

              failOnUnanswered();
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

      failOnUnanswered();

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
          if (generatedMigrations || blockRenames.length > 0) {
            // Blocks are updated independently, so some may have landed. A rerun
            // no longer sees their changes, so handle them now.
            const pushed = await pushedBlocks(space, local, [
              ...(generatedMigrations?.changes.map((comp) => comp.componentName) ?? []),
              ...blockRenames.map((rename) => rename.to),
            ]);
            if (generatedMigrations) {
              await keepMigrationsForPushedBlocks(generatedMigrations, pushed);
            }
            if (pushed) {
              await updateFolderRestrictions(
                blockRenames.filter((rename) => pushed.has(rename.to)),
                [],
              );
            } else if (blockRenames.length > 0) {
              ui.warn(
                `The space could not be read to tell whether these blocks were renamed: ${blockRenames.map(describeRename).join(", ")}. Folders that name the old blocks as content types must be updated in the Storyblok UI.`,
              );
            }
          }
          throw error;
        }

        summary.total = pushResult.created + pushResult.updated + pushResult.deleted;
        summary.succeeded = summary.total;

        pushSpinner.succeed(
          `Pushed ${pushResult.created} creations, ${pushResult.updated} updates${pushResult.deleted > 0 ? `, ${pushResult.deleted} deletions` : ""}.`,
        );

        await updateFolderRestrictions(
          blockRenames,
          options.delete
            ? diffResult.diffs
                .filter((d) => d.type === "component" && d.action === "stale")
                .map((d) => d.name)
            : [],
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
