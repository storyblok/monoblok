import { Option } from "commander";
import { colorPalette, commands } from "../../../constants";
import { session } from "../../../session";
import { storiesCommand } from "../command";
import { getUI } from "../../../lib/ui";
import { getLogger } from "../../../lib/logger/logger";
import { getReporter } from "../../../lib/reporter/reporter";
import { requireAuthentication } from "../../../utils/auth";
import { handleError, toError } from "../../../utils/error/error";
import { CommandError } from "../../../utils/error/command-error";
import {
  assertSupportedOptions,
  buildPublishStatusFilters,
  buildQueryParams,
  buildWhereFilters,
} from "./actions";
import { prepareCapiFilter } from "./pipeline";
import { runFind } from "./run";
import { runCheckReferences } from "./check-references";
import type { FindOptions } from "./types";

function collectValues(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

const findCmd = storiesCommand
  .command("find [text]")
  .description("Find stories matching filters. Outputs JSONL to stdout (one story JSON per line).")
  .option("-s, --space <space>", "space ID")
  .addOption(
    new Option("--search-mode <mode>", "search mode")
      .choices(["fulltext", "semantic"])
      .default("fulltext"),
  )
  .addOption(
    new Option("--entry-type <type>", "filter by entry type")
      .choices(["all", "story", "folder"])
      .default("all"),
  )
  .option("--starts-with <path>", "scope to story subtree")
  .option("--container-block <name>", "filter by container block type (server-side)")
  .option("--includes-block <name>", "block presence at any depth (server-side, comma-separated)")
  .option(
    "-q, --query <query>",
    "filter by root-level content attributes (server-side, MAPI filter_query)",
  )
  .option(
    "--where <jsonpath>",
    "client-side JSONPath (RFC 9535) filter (repeatable)",
    collectValues,
    [],
  )
  .addOption(
    new Option("--publish-status <status>", "filter by publish status").choices([
      "published",
      "changed",
      "draft",
    ]),
  )
  .option("--references <uuid>", "find stories referencing this UUID (server-side)")
  .option("--check-references", "detect broken references and stale cached_url (client-side)")
  .option(
    "--skip-content",
    "skip the per-story content fetch and emit list metadata only (no content-dependent filters)",
  )
  .option(
    "--capi-filter",
    "evaluate --where against bulk CAPI content and fetch only the matches (requires --where)",
  )
  .option(
    "--capi-params <params>",
    "extra CAPI query params for --capi-filter, e.g. '{version: published, language: de}'",
  );

findCmd.action(async (text: string | undefined, options: FindOptions, command) => {
  const ui = getUI();
  const logger = getLogger();
  const reporter = getReporter();

  ui.title(`${commands.STORIES}`, colorPalette.STORIES, "Finding stories...");
  logger.info("Finding stories started", { text, ...options });

  const { space, verbose } = command.optsWithGlobals();
  const { state } = session();

  if (!requireAuthentication(state, verbose)) {
    return;
  }
  if (!space) {
    handleError(
      new CommandError("Please provide the space as argument --space YOUR_SPACE_ID."),
      verbose,
    );
    return;
  }

  try {
    // Validate and compile everything before the first request, so a bad flag or
    // a malformed JSONPath fails as a usage error instead of mid-stream.
    assertSupportedOptions(options);
    const params = buildQueryParams(text, options);
    const publishStatusFilters = buildPublishStatusFilters(options);
    const whereFilters = buildWhereFilters(options.where);

    const context = { spaceId: space, params, ui, logger, reporter, verbose };

    const capi = options.capiFilter
      ? await prepareCapiFilter({
          spaceId: space,
          region: state.region,
          capiParams: options.capiParams,
          // The reference scan reads every story in scope, so there is nothing to
          // prune for: the stage runs purely as a bulk content source.
          filters: options.checkReferences ? [] : whereFilters,
          attachContent: options.checkReferences === true,
          checkReferences: options.checkReferences === true,
          ui,
        })
      : undefined;

    if (options.checkReferences) {
      await runCheckReferences({ ...context, publishStatusFilters, whereFilters, capi });
    } else {
      await runFind({
        ...context,
        preContentFilters: publishStatusFilters,
        filters: whereFilters,
        skipContent: options.skipContent === true,
        capi,
      });
    }
  } catch (maybeError) {
    handleError(toError(maybeError), verbose);
  }
});
