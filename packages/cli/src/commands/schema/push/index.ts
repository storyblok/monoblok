import { rm } from "node:fs/promises";
import { confirm } from "@inquirer/prompts";
import { Option } from "commander";
import { basename } from "pathe";

import { colorPalette, commands } from "../../../constants";
import {
  CommandError,
  handleError,
  isRecord,
  requireAuthentication,
  toError,
} from "../../../utils";
import { getLogger } from "../../../lib/logger/logger";
import { getReporter } from "../../../lib/reporter/reporter";
import { getUI, stderrPromptContext } from "../../../lib/ui";
import { session } from "../../../session";
import { resolvePath } from "../../../utils/filesystem";
import { schemaCommand } from "../command";
import { displayPath } from "../utils";
import type { SchemaPushOptions } from "./constants";
import type { ChangesetData, SchemaData } from "../types";
import { loadSchema } from "../load-schema";
import { diffSchema } from "../diff-schema";
import { fetchRemoteSchema, localToNormalized, remoteToNormalized } from "../actions";
import { buildGroupPathByUuid } from "../folders";
import { buildChangesetEntries, executePush, formatDiffOutput } from "./actions";
import { saveChangeset } from "../changeset";
import { analyzeBreakingChanges } from "./migrations/analyze";
import type { BreakingChange, ComponentBreakingChanges } from "./migrations/types";
import {
  applyDeclaredRenames,
  checkDeclaredRenames,
  parseDeclaredRenames,
} from "./migrations/declared-renames";
import {
  migrationTitle,
  renderMigrationCode,
  toMigrationOps,
  writeMigrationFile,
} from "./migrations/generate";
import {
  pendingContentMigrations,
  plural,
  writeContentMigration,
} from "../../migrations/content-migrations";
import { writeLocalComponents } from "./write-local-components";
import {
  detectBlockRenames,
  parseDeclaredBlockRenames,
  withBlockRenames,
  withRenamedBlocks,
} from "./block-renames";
import type { BlockRename } from "./block-renames";
import { countStoriesUsing, describeFolder, foldersNaming } from "./story-folders";

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

/** Quotes a path for pasting into a shell when it holds characters the shell would split or expand. */
function shellQuote(path: string): string {
  return /^[\w./:@-]+$/.test(path) ? path : `'${path.replaceAll("'", `'\\''`)}'`;
}

const describeRename = ({ from, to }: BlockRename): string => `${from} → ${to}`;

/** The ids of the content migrations among `files`, which are named after their id. */
function contentMigrationIds(files: readonly string[]): string[] {
  return files
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".before.ts"))
    .map((file) => basename(file, ".ts"));
}

/** An error's message, after the HTTP status of a failed request. */
function describeError(maybeError: unknown): string {
  const { message } = toError(maybeError);
  const status =
    isRecord(maybeError) && isRecord(maybeError.response) ? maybeError.response.status : undefined;
  return typeof status === "number" && status > 0 ? `HTTP ${status}: ${message}` : message;
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
  .option("--dry-run", "Show diffs without applying changes", false)
  .option("--delete", "Delete remote entities not present in local schema", false)
  .option("--force", "With --delete, delete blocks that stories still use", false)
  .option(
    "-y, --yes",
    "Accept every block and field rename schema push detects, and generate migration files, without asking",
    false,
  )
  .option(
    "--rename <block.field:new-field>",
    "Rename a field of a block in the generated migration, which it generates without asking; name a renamed block by its new name (repeatable)",
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

    if (options.typed && options.migrations === false) {
      ui.warn("--typed has no effect with --no-migrations.");
    }
    if (options.rename.length > 0 && options.migrations === false) {
      ui.warn("--rename has no effect with --no-migrations.");
    }
    if (options.yes && !options.renames) {
      ui.warn(
        "--no-renames overrides --yes: detected renames count as removals plus new blocks or fields.",
      );
    }

    const summary = { total: 0, succeeded: 0, failed: 0 };
    let generatedMigrations: { files: string[]; changes: ComponentBreakingChanges[] } | undefined;
    const runCommand = "migrations run";
    const runMigrations = `storyblok ${runCommand} --space ${space}${basePath ? ` --path ${shellQuote(basePath)}` : ""}`;

    /**
     * On a dry run or without a terminal, questions are collected instead of
     * asked, so a script or CI run never waits on a prompt. A dry run lists
     * them, and `failOnUnanswered` names all of them at once before anything
     * is written. Until then each one counts as accepted, so the questions that
     * follow from it are collected too.
     */
    const unanswered: string[] = [];
    const ask = async (message: string, flags: string, defaultAnswer = true): Promise<boolean> => {
      if (options.dryRun || !process.stdin.isTTY) {
        unanswered.push(`${message} ${flags}`);
        return true;
      }
      return confirm({ message, default: defaultAnswer }, stderrPromptContext);
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
          title: migrationTitle(changes),
          schemaEntry: entryFile,
          ops,
          // The space renames a block in its stories along with the block, so
          // the migration reads it under its new name.
          before: options.before
            ? { components: withRenamedBlocks(rawComponents, blockRenames), blocks }
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
      ): Promise<string[]> => {
        const listed = (files: string[]) =>
          files.map((file) => `  - ${displayPath(file, basePath)}`).join("\n");
        if (!pushed) {
          ui.warn(
            `The push failed after these migration files were written:\n${listed(generated.files)}\nThe space could not be read to tell which blocks were pushed. Keep the ops for the blocks the push already updated, delete the rest, then run schema push again.`,
          );
          return generated.files;
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
          return [];
        }
        ui.warn(
          `The push failed, but it updated ${[...pushed].join(", ")}. The migration for ${pushed.size === 1 ? "it" : "them"} was kept:\n${listed(files)}\nFix the error and run schema push again to generate the migration for the other blocks.`,
        );
        return files;
      };
      /**
       * The space removes a deleted block from the content types of the folders
       * that name it, which lifts the restriction of a folder left without one.
       */
      const warnAboutFoldersNaming = async (deleted: readonly string[]): Promise<void> => {
        if (deleted.length === 0) return;
        try {
          const folders = await foldersNaming(space, new Set(deleted));
          if (folders.length === 0) return;
          const named = deleted.filter((name) =>
            folders.some((folder) => [folder.defaultRoot, ...folder.contentTypes].includes(name)),
          );
          ui.warn(
            `Deleting ${named.join(", ")} removes ${named.length === 1 ? "it" : "them"} from the content types of ${plural(folders.length, "folder", "folders")}: ${folders.map(describeFolder).join(", ")}. A folder left without content types accepts every content type.`,
          );
        } catch (maybeError) {
          const { message } = toError(maybeError);
          logger.warn("Failed to check folders for deleted blocks", {
            deleted: [...deleted],
            error: message,
          });
          ui.warn(
            `The folders that name deleted blocks as content types could not be checked: ${message}`,
          );
        }
      };

      remoteSpinner.succeed(
        `Remote: ${remote.components.size} components, ${remote.datasources.size} datasources`,
      );

      // Read before the push writes a migration of its own.
      const pendingMigrations = await pendingContentMigrations(basePath, space).catch(
        (maybeError: unknown) => {
          logger.warn("Failed to list pending content migrations", {
            error: toError(maybeError).message,
          });
          return [];
        },
      );

      // 3. Diff components, datasources, and folders (component groups).
      // from = remote (base), to = local (target): the diff describes the push.
      // The local DSL opts into group-uuid diffing, so a block that sets
      // `component_group_uuid` explicitly gets its membership pushed.
      const declaredRenames = parseDeclaredRenames(options.rename);

      const diff = () =>
        diffSchema(remoteToNormalized(remote), localToNormalized(local), {
          compareGroupUuid: true,
        });
      let diffResult = diff();

      // 4. Pair blocks only the space has with blocks only the schema has, so
      // a confirmed rename renames the block in place, along with the stories
      // and folders that use it, instead of creating a new block and leaving
      // the stories on a stale one.
      const storyCounts = new Map<string, Promise<number>>();
      const storiesUsing = (block: string): Promise<number> => {
        const count = storyCounts.get(block) ?? countStoriesUsing(space, block);
        storyCounts.set(block, count);
        return count;
      };
      const usage = (count: number | undefined) =>
        count === undefined ? "" : ` (${plural(count, "story", "stories")})`;
      const declaredBlockRenames = parseDeclaredBlockRenames(options.renameBlock);
      for (const declared of declaredBlockRenames) {
        const label = `--rename-block ${declared.from}:${declared.to}`;
        const actionOf = (name: string) =>
          diffResult.diffs.find((d) => d.type === "component" && d.name === name)?.action;
        if (actionOf(declared.from) !== "stale") {
          throw new CommandError(
            remote.components.has(declared.from)
              ? `${label}: the schema still has a block ${declared.from}, so the push doesn't remove it.`
              : `${label}: the space has no block ${declared.from}.`,
          );
        }
        if (actionOf(declared.to) !== "create") {
          throw new CommandError(
            remote.components.has(declared.to)
              ? `${label}: the space already has a block ${declared.to}.`
              : `${label}: the schema has no block ${declared.to}.`,
          );
        }
        const wasRoot = Boolean(remote.components.get(declared.from)?.is_root);
        const isRoot = Boolean(local.components.find((c) => c.name === declared.to)?.is_root);
        if (wasRoot !== isRoot) {
          ui.warn(
            wasRoot
              ? `${label} turns the content type ${declared.from} into the nestable block ${declared.to}.`
              : `${label} turns the nestable block ${declared.from} into the content type ${declared.to}.`,
          );
        }
      }
      // Possible renames of blocks no --rename-block names, for --delete to point to.
      const detectedBlockRenames = detectBlockRenames(diffResult, local, remote).filter(
        (rename) =>
          !declaredBlockRenames.some(
            (declared) => declared.from === rename.from || declared.to === rename.to,
          ),
      );
      const offeredBlockRenames = options.renames ? detectedBlockRenames : [];
      const remoteBeforeRenames = remote;
      const applyBlockRenames = (renames: readonly BlockRename[]) => {
        remote = withBlockRenames(remoteBeforeRenames, renames);
        diffResult = diff();
      };

      // 5. Display diffs, with every offered block rename taken as confirmed,
      // before asking about them.
      const blockRenames: BlockRename[] = [...declaredBlockRenames, ...offeredBlockRenames];
      if (blockRenames.length > 0) applyBlockRenames(blockRenames);
      ui.br();
      ui.log(formatDiffOutput(diffResult, { delete: options.delete }));

      let declinedBlockRename = false;
      for (const rename of offeredBlockRenames) {
        // The count only informs the question, so a failed lookup leaves it out.
        const stories = usage(await storiesUsing(rename.from).catch(() => undefined));
        const confirmed =
          options.yes ||
          (await ask(
            `Rename block ${rename.from} → ${rename.to}${stories}? Otherwise ${rename.to} is created as a new block.`,
            `Pass --yes or --rename-block ${rename.from}:${rename.to} to rename it, or --no-renames to create ${rename.to} as a new block.`,
            // A wrong rename changes every story using the block, so it takes a yes.
            false,
          ));
        if (!confirmed) {
          blockRenames.splice(blockRenames.indexOf(rename), 1);
          declinedBlockRename = true;
        }
      }
      if (declinedBlockRename) {
        applyBlockRenames(blockRenames);
        ui.br();
        ui.info("Without the block renames you declined:");
        ui.log(formatDiffOutput(diffResult, { delete: options.delete }));
      }
      checkDeclaredRenames(declaredRenames, local, remote, blockRenames);

      // Deleting a block stories still use leaves their content without a
      // schema, so it takes --force.
      if (options.delete && !options.force) {
        const refuse = (message: string) => {
          if (!options.dryRun) {
            throw new CommandError(message);
          }
          ui.warn(`${message} Without --dry-run, schema push stops here unless you pass --force.`);
        };
        const used: { name: string; label: string }[] = [];
        for (const d of diffResult.diffs) {
          if (d.type !== "component" || d.action !== "stale") continue;
          let count: number;
          try {
            count = await storiesUsing(d.name);
          } catch (maybeError) {
            refuse(
              `Could not check whether stories use ${d.name}, which --delete would delete (${describeError(maybeError)}). Pass --force to delete it without checking.`,
            );
            continue;
          }
          if (count > 0) used.push({ name: d.name, label: `${d.name}${usage(count)}` });
        }
        if (used.length > 0) {
          const one = used.length === 1;
          const stories = `${one ? "the block's" : "the blocks'"} stories`;
          const force = `pass --force to delete ${one ? "it" : "them"} anyway`;
          const renameFlags = used.flatMap(({ name }) =>
            detectedBlockRenames
              .filter((rename) => rename.from === name)
              .map((rename) => `--rename-block ${rename.from}:${rename.to}`),
          );
          const advice =
            renameFlags.length > 0
              ? `Rename ${one ? "it" : "them"} with ${renameFlags.join(" and ")}, migrate ${stories} first, or ${force}.`
              : `Migrate ${stories} first, or ${force}.`;
          refuse(
            `Stories still use ${one ? "this block" : "these blocks"}, which --delete would delete: ${used.map(({ label }) => label).join(", ")}. ${advice}`,
          );
        }
      }

      const nothingToPush =
        diffResult.creates === 0 &&
        diffResult.updates === 0 &&
        (!options.delete || diffResult.stale === 0);

      // `migrations run` skips the ops of a migration that a later schema
      // change no longer matches, so one written for an earlier change goes
      // before the push, and one written for this change after it.
      if (!nothingToPush && pendingMigrations.length > 0) {
        const pendingList = pendingMigrations.join(", ");
        ui.warn(
          pendingMigrations.length === 1
            ? `1 content migration is pending on this machine: ${pendingList}. If it was written for an earlier schema change, run it with \`${runMigrations}\` before you push: once the push changes the fields it migrates, migrations run skips its ops. If it was written for the change you're pushing, run it after the push.`
            : `${pendingMigrations.length} content migrations are pending on this machine: ${pendingList}. Run the ones written for an earlier schema change with \`${runMigrations}\` before you push: once the push changes the fields they migrate, migrations run skips their ops. Run the ones written for the change you're pushing after the push.`,
        );
      }

      // 6. Analyze breaking changes and offer migration generation
      if (options.migrations !== false) {
        const breakingChanges = analyzeBreakingChanges(diffResult, local, remote);
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

          // --migrations generates without asking, and has always taken
          // detected field renames as given. A declared rename asks for a
          // migration that holds it.
          const explicitMigrations = command.getOptionValueSource("migrations") === "cli";
          const renamedBlocks = new Set(declaredBlockRenames.map(({ to }) => to));
          const impliedMigrations =
            declaredRenames.size > 0 ||
            breakingChanges.some((comp) => renamedBlocks.has(comp.componentName));
          const shouldGenerate =
            explicitMigrations ||
            options.yes ||
            impliedMigrations ||
            (await ask(
              "Generate migration files for breaking changes?",
              "Pass --migrations to generate them, which also takes detected field renames as given, --yes to generate them and accept every detected rename, or --no-migrations to skip them.",
            ));

          if (shouldGenerate) {
            for (const comp of breakingChanges) {
              const kept: BreakingChange[] = [];
              for (const change of comp.changes) {
                if (change.kind === "split") {
                  ui.info(
                    `Possible split: ${comp.componentName}.${change.field} into ${change.into.join(" and ")}. The migration throws until you write the split. Pass --rename ${comp.componentName}.${change.field}:<new-field> to rename the field instead.`,
                  );
                }
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

            if (!options.dryRun) {
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
          // Counted for the --delete check, unless --force skipped it.
          const stories = usage(await storyCounts.get(comp.name)?.catch(() => undefined));
          ui.warn(
            `Component '${comp.name}'${stories} will be deleted. Stories using it will have out-of-schema content.`,
          );
        }
        await warnAboutFoldersNaming(deletedComponents.map((comp) => comp.name));

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
        if (unanswered.length > 0) {
          ui.info(
            `Without --dry-run, schema push asks these questions. The dry run takes each as answered with yes:\n${unanswered.map((question) => `  - ${question}`).join("\n")}`,
          );
        }
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

      const changeset: ChangesetData = {
        timestamp,
        spaceId: Number(space),
        remote: {
          components: rawComponents,
          componentFolders: rawComponentFolders,
          datasources: rawDatasources,
        },
        changes: buildChangesetEntries(diffResult, local, remote, { delete: options.delete }),
        migrations: contentMigrationIds(generatedMigrations?.files ?? []),
      };
      const changesetPath = await saveChangeset(resolvedPath, changeset);
      logger.info("Changeset saved", { path: displayPath(changesetPath, basePath) });

      // 9. Execute push (skipped when nothing to push).
      let pushResult: Awaited<ReturnType<typeof executePush>> | null = null;
      if (!nothingToPush) {
        const pushSpinner = ui.createSpinner("Pushing schema...");
        const pushedComponents = new Set<string>();
        try {
          pushResult = await executePush(space, local, remote, diffResult, {
            delete: options.delete,
            renames: blockRenames,
            onComponentPushed: (name) => pushedComponents.add(name),
            onRenameWaiting: ({ from, to }, stories) =>
              ui.info(
                `Waiting for the space to rename ${from} → ${to} in ${plural(stories, "story", "stories")}...`,
              ),
          });
        } catch (error) {
          pushSpinner.failed("Failed to push schema");
          let keptMigrations: string[] = [];
          if (generatedMigrations) {
            // Blocks are updated independently, so some may have landed. A rerun
            // no longer sees their changes, so handle them now.
            const pushed = await pushedBlocks(
              space,
              local,
              generatedMigrations.changes.map((comp) => comp.componentName),
            );
            keptMigrations = await keepMigrationsForPushedBlocks(generatedMigrations, pushed);
          }
          // `migrations generate --before-push` reads the changeset, so it
          // must not take a block the push failed to change for changed.
          await saveChangeset(resolvedPath, {
            ...changeset,
            changes: changeset.changes.map((change) =>
              change.type === "component" && !pushedComponents.has(change.name)
                ? { ...change, failed: true }
                : change,
            ),
            migrations: contentMigrationIds(keptMigrations),
          }).catch((maybeError: unknown) => {
            logger.warn("Failed to mark failed changes in the changeset", {
              path: displayPath(changesetPath, basePath),
              error: toError(maybeError).message,
            });
          });
          throw error;
        }

        summary.total = pushResult.created + pushResult.updated + pushResult.deleted;
        summary.succeeded = summary.total;

        pushSpinner.succeed(
          `Pushed ${pushResult.created} creations, ${pushResult.updated} updates${pushResult.deleted > 0 ? `, ${pushResult.deleted} deletions` : ""}.`,
        );

        if (blockRenames.length > 0) {
          ui.info(
            `Renamed ${blockRenames.map(describeRename).join(", ")} in the space, along with the stories and folders that use ${blockRenames.length === 1 ? "it" : "them"}.`,
          );
        }
        for (const { rename, stories } of pushResult.unfinishedRenames) {
          ui.warn(
            `${plural(stories, "story", "stories")} still ${stories === 1 ? "uses" : "use"} ${rename.from}: the space stopped renaming the block to ${rename.to} in them. Rename it there with a content migration that holds renameBlock({ block: '${rename.from}', to: '${rename.to}' }), written without a .before.ts snapshot (migrations generate ${rename.to} --schema <entry-file> --no-before), then run it.`,
          );
        }

        if (generatedMigrations) {
          ui.info(
            `Generated migrations are scaffolds. Review and adjust them before running \`storyblok ${runCommand}\`.`,
          );
          ui.info(`Run migrations when ready: ${runMigrations}`);
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
