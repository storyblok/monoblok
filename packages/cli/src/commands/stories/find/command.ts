import { Option } from "commander";
import { pipeline } from "node:stream/promises";
import { colorPalette, commands } from "../../../constants";
import { session } from "../../../session";
import { storiesCommand } from "../command";
import { getUI } from "../../../lib/ui";
import { getLogger } from "../../../lib/logger/logger";
import { getReporter } from "../../../lib/reporter/reporter";
import { fetchStoriesStream, fetchStoryStream } from "../streams";
import { requireAuthentication } from "../../../utils/auth";
import { handleError, toError } from "../../../utils/error/error";
import { CommandError } from "../../../utils/error/command-error";
import { fetchComponents } from "../../components/pull/actions";
import {
  assertSupportedOptions,
  applyClientFilters,
  buildPublishStatusFilters,
  buildQueryParams,
  buildWhereFilters,
  resolveReferenceTargets,
} from "./actions";
import { createJsonlWriter, filterListedStoriesStream, filterStoriesStream } from "./streams";
import { buildRelationFieldMap, detectIssues, extractReferences, toTargetMeta } from "./references";
import type { RefEntry, RefIssue, TargetMeta } from "./references";
import type { ClientFilter, FindOptions } from "./types";
import type { StoriesQueryParams, Story } from "../constants";

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
  .option("--contains-block <name>", "block presence at any depth (server-side, comma-separated)")
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
  .option("--check-references", "detect broken references and stale cached_url (client-side)");

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

    if (options.checkReferences) {
      await runCheckReferences({ ...context, publishStatusFilters, whereFilters });
    } else {
      await runFind({
        ...context,
        preContentFilters: publishStatusFilters,
        filters: whereFilters,
      });
    }
  } catch (maybeError) {
    handleError(toError(maybeError), verbose);
  }
});

type FindContext = {
  spaceId: string;
  params: StoriesQueryParams;
  ui: ReturnType<typeof getUI>;
  logger: ReturnType<typeof getLogger>;
  reporter: ReturnType<typeof getReporter>;
  verbose: boolean;
};

/** Widest label, so every bar's `[` lines up. */
const PROGRESS_LABEL_WIDTH = "Fetching server-side filtered stories".length;
const label = (text: string): string => text.padEnd(PROGRESS_LABEL_WIDTH);

type PhaseCounters = {
  list: { total: number; succeeded: number; skipped: number; failed: number };
  content: { total: number; succeeded: number; failed: number };
  process: { total: number; succeeded: number; skipped: number; failed: number };
};

const createCounters = (): PhaseCounters => ({
  list: { total: 0, succeeded: 0, skipped: 0, failed: 0 },
  content: { total: 0, succeeded: 0, failed: 0 },
  process: { total: 0, succeeded: 0, skipped: 0, failed: 0 },
});

/**
 * Milliseconds from the start of the run until each phase last made progress.
 *
 * The phases overlap on purpose — content fetches begin while later pages are
 * still listing — so these are "finished by" marks against a single clock, not
 * three durations that add up to the total.
 */
type PhaseTimings = {
  startedAt: number;
  list: number;
  content: number;
  process: number;
};

const createTimings = (): PhaseTimings => ({
  startedAt: Date.now(),
  list: 0,
  content: 0,
  process: 0,
});

/**
 * Renders a phase mark as an elapsed-since-start reading.
 *
 * Written as `done @12.3s` rather than a bare duration because the phases
 * overlap: listing reads "slow" whenever backpressure holds the pager back
 * waiting on content fetches, which is the pipeline working, not stalling.
 */
const formatMark = (ms: number): string => `done @${(ms / 1000).toFixed(1)}s`;

/**
 * Streams the three fetch/filter phases and reports each with its own bar.
 *
 * The list endpoint omits `content`, so every story has to be re-fetched
 * individually. `fetchStoryStream` does that in parallel behind the shared
 * pipeline backpressure lock, and the MAPI client paces the requests with the
 * globally configured rate limit — there is no per-command concurrency knob.
 *
 * `processStories` is the terminal stage; it decides what each matched story
 * turns into (JSONL now, a buffered reference candidate for `--check-references`).
 */
async function runStoryPipeline({
  spaceId,
  params,
  preContentFilters,
  filters,
  processLabel,
  counters,
  timings,
  onListed,
  onMatch,
  ui,
  logger,
  verbose,
}: Omit<FindContext, "reporter"> & {
  /** Decided from list metadata alone, so matching stories skip the content fetch. */
  preContentFilters: ClientFilter[];
  filters: ClientFilter[];
  processLabel: string;
  counters: PhaseCounters;
  timings: PhaseTimings;
  /** Called for every listed story, before its content is fetched. */
  onListed?: (story: Story) => void;
  onMatch: (story: Story) => void;
}): Promise<void> {
  const listProgress = ui.createProgressBar({
    title: label("Fetching server-side filtered stories"),
  });
  const contentProgress = ui.createProgressBar({ title: label("Fetching stories content") });
  const processProgress = ui.createProgressBar({ title: label(processLabel) });

  await pipeline(
    fetchStoriesStream({
      spaceId,
      params,
      setTotalStories: (total) => {
        // Fires once per page, so it has to re-derive rather than assign: stories
        // already dropped before their content fetch must stay subtracted, or each
        // page boundary would reset the downstream totals back to the full count.
        counters.list.total = total;
        counters.content.total = total - counters.list.skipped;
        counters.process.total = total - counters.list.skipped;
        listProgress.setTotal(total);
        contentProgress.setTotal(counters.content.total);
        processProgress.setTotal(counters.process.total);
      },
      onStoryListed: (story) => {
        counters.list.succeeded += 1;
        timings.list = Date.now() - timings.startedAt;
        listProgress.increment();
        onListed?.(story);
      },
      onPageSuccess: (page, total) => {
        logger.info(`Fetched stories page ${page} of ${total}`);
      },
      onPageError: (error, page, total) => {
        counters.list.failed += 1;
        handleError(error, verbose, { page, total });
      },
    }),
    filterListedStoriesStream({
      filters: preContentFilters,
      onDropped: () => {
        // Never fetched, never processed: shrink both downstream totals so the
        // bars still land on 100% instead of stalling short.
        counters.list.skipped += 1;
        counters.content.total -= 1;
        counters.process.total -= 1;
        contentProgress.setTotal(counters.content.total);
        processProgress.setTotal(counters.process.total);
      },
    }),
    fetchStoryStream({
      spaceId,
      onIncrement: () => {
        timings.content = Date.now() - timings.startedAt;
        contentProgress.increment();
      },
      onStorySuccess: () => {
        counters.content.succeeded += 1;
      },
      onStoryError: (error, story) => {
        counters.content.failed += 1;
        // A story that never arrived can never be processed; keep the last bar's
        // total honest so it still reaches 100%.
        counters.process.total -= 1;
        processProgress.setTotal(counters.process.total);
        handleError(error, verbose, { storyId: story.id });
      },
    }),
    filterStoriesStream({
      filters,
      onIncrement: () => {
        timings.process = Date.now() - timings.startedAt;
        processProgress.increment();
      },
      onMatch: (story) => {
        counters.process.succeeded += 1;
        onMatch(story);
      },
      onSkip: () => {
        counters.process.skipped += 1;
      },
      onStoryError: (error, story) => {
        counters.process.failed += 1;
        handleError(error, verbose, { storyId: story.id });
      },
    }),
  );
}

async function runFind({
  spaceId,
  params,
  preContentFilters,
  filters,
  ui,
  logger,
  reporter,
  verbose,
}: FindContext & { preContentFilters: ClientFilter[]; filters: ClientFilter[] }): Promise<void> {
  const counters = createCounters();
  const timings = createTimings();
  const output = createJsonlWriter({ write: (line) => ui.writeMachineOutput(line) });

  try {
    await runStoryPipeline({
      spaceId,
      params,
      preContentFilters,
      filters,
      processLabel: "Applying client-side filters",
      counters,
      timings,
      onMatch: (story) => output.push(story),
      ui,
      logger,
      verbose,
    });
  } finally {
    ui.stopAllProgressBars();
    output.flush();

    const { list, content, process: filtered } = counters;
    ui.br();
    ui.info(
      filters.length > 0
        ? `Results: ${filtered.succeeded} stories matched (${content.succeeded} fetched, ${list.skipped + filtered.skipped} filtered out client-side)`
        : `Results: ${filtered.succeeded} stories found`,
    );
    ui.list([
      `Listing stories: ${list.succeeded}/${list.total} listed, ${list.skipped} skipped before fetch, ${list.failed} page(s) failed. (${formatMark(timings.list)})`,
      `Fetching content: ${content.succeeded}/${content.total} succeeded, ${content.failed} failed. (${formatMark(timings.content)})`,
      `Applying filters: ${filtered.succeeded}/${filtered.total} matched, ${filtered.skipped} skipped, ${filtered.failed} failed. (${formatMark(timings.process)})`,
    ]);

    logger.info("Finding stories finished", { ...counters, timings });
    reporter.addMeta("phaseTimingsMs", {
      list: timings.list,
      content: timings.content,
      filter: timings.process,
      total: Date.now() - timings.startedAt,
    });
    reporter.addSummary("listStoriesResults", list);
    reporter.addSummary("fetchContentResults", content);
    reporter.addSummary("filterResults", {
      total: filtered.total,
      succeeded: filtered.succeeded,
      skipped: filtered.skipped,
      failed: filtered.failed,
    });
    reporter.finalize();
  }
}

type ReferenceCandidate = {
  story: Story;
  refs: RefEntry[];
};

async function runCheckReferences({
  spaceId,
  params,
  publishStatusFilters,
  whereFilters,
  ui,
  logger,
  reporter,
  verbose,
}: FindContext & {
  publishStatusFilters: ClientFilter[];
  whereFilters: ClientFilter[];
}): Promise<void> {
  // Relation fields are only recognisable from the block schema, so the
  // component list has to be loaded before any story is inspected.
  const schemaSpinner = ui.createSpinner("Fetching component schema...");
  let components;
  try {
    components = await fetchComponents(spaceId);
  } catch (error) {
    schemaSpinner.failed("Failed to fetch component schema");
    throw error;
  }
  if (!components) {
    schemaSpinner.failed("Failed to fetch component schema");
    return;
  }
  const relationFieldMap = buildRelationFieldMap(components);
  schemaSpinner.succeed(
    `Loaded ${components.length} components (${relationFieldMap.size} with relation fields)`,
  );

  const counters = createCounters();
  const timings = createTimings();
  const uuidToMeta = new Map<string, TargetMeta>();
  const candidates: ReferenceCandidate[] = [];
  const output = createJsonlWriter({ write: (line) => ui.writeMachineOutput(line) });
  let checked = 0;
  let matched = 0;
  let externalTargets = 0;

  try {
    await runStoryPipeline({
      spaceId,
      params,
      // Publish status is decidable from list metadata, so it narrows before the
      // content fetch. `--where` runs after enrichment so it can match `_ref_issues`.
      preContentFilters: publishStatusFilters,
      filters: [],
      processLabel: "Checking references",
      counters,
      timings,
      // Index from the list phase: it already carries `full_slug` and
      // `published`, it covers every story in scope rather than only the
      // filtered ones, and it stays complete even if a content fetch fails —
      // all three keep resolvable references out of the `by_uuids` lookup below.
      onListed: (story) => {
        if (story.uuid) {
          uuidToMeta.set(story.uuid, toTargetMeta(story));
        }
      },
      onMatch: (story) => {
        checked += 1;
        const refs = extractReferences(story, relationFieldMap);
        // A story with no references can never have a reference issue, so it is
        // counted as checked but never buffered — full story content dominates
        // memory on a large space.
        if (refs.length > 0) {
          candidates.push({ story, refs });
        }
      },
      ui,
      logger,
      verbose,
    });

    ui.stopAllProgressBars();

    const missingUuids = new Set<string>();
    for (const { refs } of candidates) {
      for (const ref of refs) {
        if (!uuidToMeta.has(ref.targetUuid)) {
          missingUuids.add(ref.targetUuid);
        }
      }
    }
    externalTargets = missingUuids.size;

    if (missingUuids.size > 0) {
      const targetSpinner = ui.createSpinner(
        `Resolving ${missingUuids.size} external reference targets...`,
      );
      try {
        const resolved = await resolveReferenceTargets({ spaceId, uuids: missingUuids });
        for (const [uuid, meta] of resolved) {
          uuidToMeta.set(uuid, meta);
        }
        targetSpinner.succeed(`Resolved ${resolved.size}/${missingUuids.size} external targets`);
      } catch (error) {
        targetSpinner.failed("Failed to resolve external reference targets");
        throw error;
      }
    }

    for (const { story, refs } of candidates) {
      const issues = detectIssues(refs, uuidToMeta);
      if (issues.length === 0) {
        continue;
      }
      const enriched: Story & { _ref_issues: RefIssue[] } = { ...story, _ref_issues: issues };
      if (applyClientFilters(enriched, whereFilters)) {
        matched += 1;
        output.push(enriched);
      }
    }
  } finally {
    ui.stopAllProgressBars();
    output.flush();

    const { list, content } = counters;
    ui.br();
    ui.info(
      `Results: ${matched} stories with reference issues (${checked} checked, ${externalTargets} external targets resolved)`,
    );
    ui.list([
      `Listing stories: ${list.succeeded}/${list.total} listed, ${list.skipped} skipped before fetch, ${list.failed} page(s) failed. (${formatMark(timings.list)})`,
      `Fetching content: ${content.succeeded}/${content.total} succeeded, ${content.failed} failed. (${formatMark(timings.content)})`,
      `Checking references: ${checked} checked, ${candidates.length} with references, ${matched} with issues. (${formatMark(timings.process)})`,
      `Resolving + detecting: ${externalTargets} external targets. (done @${((Date.now() - timings.startedAt) / 1000).toFixed(1)}s)`,
    ]);

    reporter.addMeta("phaseTimingsMs", {
      list: timings.list,
      content: timings.content,
      check: timings.process,
      total: Date.now() - timings.startedAt,
    });
    logger.info("Reference check finished", {
      ...counters,
      timings,
      checked,
      withReferences: candidates.length,
      issues: matched,
      externalTargets,
    });
    reporter.addSummary("listStoriesResults", list);
    reporter.addSummary("fetchContentResults", content);
    reporter.addSummary("referenceCheckResults", {
      total: checked,
      succeeded: checked - matched,
      failed: matched,
    });
    reporter.finalize();
  }
}
