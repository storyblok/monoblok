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
  .action(async (options: { from: string; to: string }, command) => {
    const ui = getUI();
    const logger = getLogger();
    const { verbose } = command.optsWithGlobals();
    const { state } = session();
    const { from, to } = options;

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

      // Group UUIDs are per-space identifiers, so they are meaningless to
      // compare against a remote space. Only diff them when both sides are local
      // files, where an explicit `component_group_uuid` is a deliberate choice.
      const compareGroupUuid = !isSpaceRef(from) && !isSpaceRef(to);
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
