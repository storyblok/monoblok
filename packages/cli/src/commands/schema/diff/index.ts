import { colorPalette, commands } from "../../../constants";
import { handleError, requireAuthentication, toError } from "../../../utils";
import { getLogger } from "../../../lib/logger/logger";
import { getUI } from "../../../lib/ui";
import { session } from "../../../session";
import { schemaCommand } from "../command";
import { diffSchema } from "../diff-schema";
import type { NormalizedSchema } from "../types";
import { formatSchemaDiff, isSpaceRef, resolveSource } from "./actions";

schemaCommand
  .command("diff")
  .description("Diff two schemas (space IDs or local entry files) and report what changed")
  .requiredOption(
    "--from <space-id|path>",
    "Base schema to compare against: a space ID or a path to a schema entry file",
  )
  .requiredOption(
    "--to <space-id|path>",
    "Target schema: a space ID or a path to a schema entry file",
  )
  .addHelpText(
    "after",
    `
Entities are reported as added, changed, or removed relative to --to.

Use --from <space-id> --to <path> to mirror what \`schema push <path>\` would do to
that space. Only that direction reports a block's explicit component_group_uuid,
which is the escape hatch push acts on; between two spaces the per-space group
uuids and tag ids are translated to folder paths and tag names before comparing.`,
  )
  .action(async (options: { from: string; to: string }, command) => {
    const ui = getUI();
    const logger = getLogger();
    const { verbose } = command.optsWithGlobals();
    const { state } = session();
    // Trimmed once here so a ref padded with whitespace resolves and prints the
    // same way `resolveSource` reads it.
    const from = options.from.trim();
    const to = options.to.trim();

    ui.title(commands.SCHEMA, colorPalette.SCHEMA, "Diffing schema...");
    logger.info("Schema diff started", { from, to });

    // Authentication is only required when a side points at a remote space.
    if ((isSpaceRef(from) || isSpaceRef(to)) && !requireAuthentication(state, verbose)) {
      return;
    }

    try {
      const resolveSpinner = ui.createSpinner("Resolving schemas...");
      let fromSchema: NormalizedSchema;
      let toSchema: NormalizedSchema;
      try {
        [fromSchema, toSchema] = await Promise.all([
          resolveSource(from, "--from"),
          resolveSource(to, "--to"),
        ]);
      } catch (maybeError) {
        resolveSpinner.failed("Failed to resolve schemas");
        handleError(toError(maybeError), verbose);
        return;
      }
      resolveSpinner.succeed("Schemas resolved");

      // Group UUIDs are per-space identifiers, so comparing two spaces by them
      // says nothing. A block written in code that sets `component_group_uuid`
      // explicitly is the deliberate escape hatch, and `schema push` diffs it —
      // so whenever the target is a schema file, this reports what that push
      // would do. The check itself only fires on a target block that sets it.
      const compareGroupUuid = !isSpaceRef(to);
      const diffResult = diffSchema(fromSchema, toSchema, { compareGroupUuid });

      // The diff itself goes to stdout while the surrounding chrome stays on
      // stderr, so `schema diff --from a --to b > changes.diff` captures the
      // diff and nothing else. Chalk drops its colors on its own when stdout is
      // not a terminal.
      ui.br();
      ui.writeMachineOutput(formatSchemaDiff(diffResult, from, to));

      logger.info("Schema diff finished", {
        create: diffResult.creates,
        update: diffResult.updates,
        unchanged: diffResult.unchanged,
        stale: diffResult.stale,
      });
    } catch (maybeError) {
      handleError(toError(maybeError), verbose);
    }
  });
