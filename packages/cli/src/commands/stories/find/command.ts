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
  parseIssueTypes,
  parseLimit,
} from "./actions";
import { prepareCapiFilter } from "./pipeline";
import { runFind } from "./run";
import { runCheckReferences } from "./check-references";
import type { FindOptions } from "./types";

function collectValues(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

const findCmd = storiesCommand
  .command("find")
  .description(
    "Find stories matching filters and print them to stdout as JSONL, one story per line. Filters combine with AND.",
  )
  .argument("[text]", "full-text search over story name, slug and content (case-insensitive)")
  .option("-s, --space <space>", "space ID")
  .addOption(
    new Option("--entry-type <type>", "filter by entry type")
      .choices(["all", "story", "folder"])
      .default("all"),
  )
  .option("--starts-with <path>", "scope to a story subtree, e.g. 'en/blog'")
  .option(
    "--container-block <name>",
    "stories whose content type (root block) is this component, e.g. 'page'",
  )
  .option(
    "--includes-block <names>",
    "stories containing all of these blocks at any depth, comma-separated",
  )
  .option(
    "-q, --query <query>",
    "filter on root-level content fields with filter_query syntax, e.g. '[category][in]=news'",
  )
  .option(
    "--where <jsonpath>",
    "JSONPath (RFC 9535) filter evaluated locally on each story, repeatable, e.g. \"$..[?(@.component == 'hero')]\" for a hero block at any depth",
    collectValues,
    [],
  )
  .option("--tag <names>", "stories carrying any of these tags, comma-separated")
  .option(
    "--workflow-stage <ids>",
    "stories at any of these workflow stage IDs (numeric), comma-separated",
  )
  .addOption(
    new Option("--publish-status <status>", "filter by publish status").choices([
      "published",
      "changed",
      "draft",
    ]),
  )
  .option(
    "--sort <fields>",
    "order by a story column or 'content.<field>', comma-separated, e.g. 'updated_at:desc' or 'content.title:asc'",
  )
  .option("--limit <n>", "stop after this many results")
  .option(
    "--references <uuids>",
    "stories that reference all of these story UUIDs, comma-separated",
  )
  .option(
    "--check-references [types]",
    "report stories with broken, unpublished or stale_url references, listed in a `_ref_issues` array on each story. Optionally only these types, comma-separated, e.g. 'broken'",
  )
  .option(
    "--skip-content",
    "skip the per-story content fetch and emit list metadata only (--where then sees metadata only)",
  )
  .option(
    "--capi-filter",
    "evaluate --where against bulk CDN content first and fetch only the matches from MAPI (requires --where)",
  )
  .option(
    "--capi-params <params>",
    "extra CDN query params for --capi-filter, e.g. 'version=published' or 'language=de'",
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
    const limit = parseLimit(options.limit);
    const issueTypes = parseIssueTypes(options.checkReferences);

    const context = { spaceId: space, params, ui, logger, reporter, verbose };

    const capi = options.capiFilter
      ? await prepareCapiFilter({
          spaceId: space,
          region: state.region,
          capiParams: options.capiParams,
          // The reference scan reads every story in scope, so there is nothing to
          // prune for: the stage runs purely as a bulk content source.
          filters: issueTypes ? [] : whereFilters,
          attachContent: issueTypes !== undefined,
          ui,
        })
      : undefined;

    if (issueTypes) {
      await runCheckReferences({
        ...context,
        publishStatusFilters,
        whereFilters,
        issueTypes,
        limit,
        capi,
      });
    } else {
      await runFind({
        ...context,
        preContentFilters: publishStatusFilters,
        filters: whereFilters,
        skipContent: options.skipContent === true,
        limit,
        capi,
      });
    }
  } catch (maybeError) {
    handleError(toError(maybeError), verbose);
  }
});
