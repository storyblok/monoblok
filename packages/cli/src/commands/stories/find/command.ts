import { Option } from "commander";
import { Readable, type Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { colorPalette, commands } from "../../../constants";
import type { RegionCode } from "../../../constants";
import { session } from "../../../session";
import { storiesCommand } from "../command";
import { getUI } from "../../../lib/ui";
import {
  createCollectingSink,
  createJsonlOutput,
  createPhaseTracker,
  formatMark,
  isDownstreamClosed,
  toPhaseSummary,
} from "../../../lib/pipe";
import type { PhaseDefinition, PhaseTracker } from "../../../lib/pipe";
import { getLogger } from "../../../lib/logger/logger";
import { getReporter } from "../../../lib/reporter/reporter";
import { fetchStoriesStream, fetchStoryStream } from "../streams";
import { requireAuthentication } from "../../../utils/auth";
import { handleError, logOnlyError, toError } from "../../../utils/error/error";
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
import { capiFilterStream, filterListedStoriesStream, filterStoriesStream } from "./streams";
import { CAPI_BATCH_SIZE, createCapiContentFetcher, parseCapiParams } from "./capi";
import type { CapiContentFetcher } from "./capi";
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

/** Everything the CAPI filter stage needs, resolved before the first page is listed. */
type CapiFilter = {
  fetchContent: CapiContentFetcher;
  filters: ClientFilter[];
  /** Read content in bulk for the stage below instead of only pruning for it. */
  attachContent?: boolean;
};

/**
 * Resolves the CDN token and builds the batch fetcher.
 *
 * Done before the pipeline starts so a space without a usable token fails as a
 * usage error, rather than after a few thousand stories have been listed.
 */
async function prepareCapiFilter({
  spaceId,
  region,
  capiParams,
  filters,
  attachContent = false,
  checkReferences = false,
  ui,
}: {
  spaceId: string;
  region: RegionCode | undefined;
  capiParams: string | undefined;
  filters: ClientFilter[];
  attachContent?: boolean;
  /** Only changes how the stage is described, since it prunes nothing there. */
  checkReferences?: boolean;
  ui: ReturnType<typeof getUI>;
}): Promise<CapiFilter> {
  const role = checkReferences ? "CAPI content source" : "CAPI filter";
  const spinner = ui.createSpinner(`Preparing the ${role}...`);
  try {
    const fetchContent = await createCapiContentFetcher({
      spaceId,
      region,
      params: parseCapiParams(capiParams),
    });
    spinner.succeed(`${role} ready (${CAPI_BATCH_SIZE} stories per request)`);
    return { fetchContent, filters, attachContent };
  } catch (error) {
    spinner.failed(`Failed to prepare the ${role}`);
    throw error;
  }
}

type FindContext = {
  spaceId: string;
  params: StoriesQueryParams;
  ui: ReturnType<typeof getUI>;
  logger: ReturnType<typeof getLogger>;
  reporter: ReturnType<typeof getReporter>;
  verbose: boolean;
};

/**
 * The phases of a find run, in pipeline order.
 *
 * Which of them exist depends on the flags — `--skip-content` removes the content
 * fetch, `--capi-filter` adds a bulk stage ahead of it — and each declares what
 * it loses, which is what keeps every total below it honest as stories are
 * dropped along the way. The tracker owns the bars, the counters and the
 * `done @Xs` marks from here on.
 */
function findPhases({
  capi,
  skipContent,
  capiLabel,
  processLabel,
}: {
  capi: boolean;
  skipContent: boolean;
  capiLabel: string;
  processLabel: string;
}): PhaseDefinition[] {
  return [
    {
      key: "list",
      label: "Fetching stories",
      counters: ["succeeded", "skipped", "failed"],
      // A story dropped from list metadata alone never reaches the stage below.
      outflow: (counts) => counts.total - counts.skipped,
    },
    {
      key: "capiFilter",
      label: capiLabel,
      enabled: capi,
      counters: ["candidates", "pruned", "unresolved", "failed"],
      // What the CAPI filter prunes never costs a MAPI fetch.
      outflow: (counts) => counts.total - counts.pruned,
    },
    {
      key: "content",
      label: "Fetching stories content",
      enabled: !skipContent,
      counters: ["succeeded", "failed"],
      // A story whose content could not be fetched cannot be decided below.
      outflow: (counts) => counts.total - counts.failed,
    },
    {
      key: "process",
      label: processLabel,
      counters: ["succeeded", "skipped", "failed"],
    },
  ];
}

/**
 * Streams the fetch/filter phases and reports each with its own bar.
 *
 * The list endpoint omits `content`, so every story has to be re-fetched
 * individually. `fetchStoryStream` does that in parallel behind the shared
 * pipeline backpressure lock, and the MAPI client paces the requests with the
 * globally configured rate limit — there is no per-command concurrency knob.
 *
 * Two stages are optional, and both exist to avoid that per-story fetch:
 * `capi` inserts a bulk CAPI filter ahead of it, and `skipContent` drops it
 * entirely. Neither changes what the last stage receives, only how much of
 * the space reaches it.
 *
 * `filterStoriesStream` is that last deciding stage, and everything it matches
 * goes to `sink` — JSONL on stdout for `find`, a buffer for
 * `--check-references`. The run therefore moves at the pace of whatever is
 * reading, rather than ahead of it.
 */
async function runStoryPipeline({
  spaceId,
  params,
  preContentFilters,
  filters,
  tracker,
  sink,
  onListed,
  capi,
  skipContent = false,
  signal,
  logger,
  verbose,
}: Omit<FindContext, "reporter" | "ui"> & {
  /** Stops the run when the reader on the other end of stdout exits first. */
  signal?: AbortSignal;
  /** Decided from list metadata alone, so matching stories skip the content fetch. */
  preContentFilters: ClientFilter[];
  filters: ClientFilter[];
  tracker: PhaseTracker;
  /** Where a match goes. Its backpressure is what paces the whole run. */
  sink: Writable;
  /** Called for every listed story, before its content is fetched. */
  onListed?: (story: Story) => void;
  /** Prunes candidates with bulk CAPI content before the per-story MAPI fetch. */
  capi?: CapiFilter;
  /** Emits list metadata without fetching content at all. */
  skipContent?: boolean;
}): Promise<void> {
  const list = tracker.phase("list");
  const capiFilter = tracker.phase("capiFilter");
  const content = tracker.phase("content");
  const processed = tracker.phase("process");

  /**
   * Ids the CAPI filter matched, so the last stage does not test them again.
   *
   * Holding only the survivors keeps this small — it is the same set that reaches
   * the content fetch, and every entry leaves the pipeline as a result.
   */
  const matchedByCapiFilter = capi ? new Set<Story["id"]>() : undefined;

  // Aborting the pipeline tears every in-flight stage down at once, and each one
  // reports that teardown through its own error callback: a listing page, a CAPI
  // batch and a content fetch all surface the same `AbortError`. None of them is
  // a failure — it is this run being stopped on purpose — so none may print, be
  // counted, or reach the exit code. Once the signal has fired there is no
  // independent failure left to distinguish, so everything after it is swallowed.
  const causedByStop = (error: Error): boolean =>
    signal?.aborted === true || isDownstreamClosed(error);

  const stages = [
    fetchStoriesStream({
      spaceId,
      params,
      setTotalStories: (total) => {
        list.setTotal(total);
      },
      onStoryListed: (story) => {
        list.count("succeeded");
        list.tick();
        onListed?.(story);
      },
      onPageSuccess: (page, total) => {
        logger.info(`Fetched stories page ${page} of ${total}`);
      },
      onPageError: (error, page, total) => {
        if (causedByStop(error)) {
          return;
        }
        list.count("failed");
        handleError(error, verbose, { page, total });
      },
    }),
    filterListedStoriesStream({
      filters: preContentFilters,
      onDropped: () => {
        list.count("skipped");
      },
    }),
    ...(capi
      ? [
          capiFilterStream({
            fetchContent: capi.fetchContent,
            filters: capi.filters,
            attachContent: capi.attachContent,
            onCandidate: (story) => {
              capiFilter.count("candidates");
              matchedByCapiFilter?.add(story.id);
            },
            onPruned: () => {
              capiFilter.count("pruned");
            },
            onUnresolved: () => {
              capiFilter.count("unresolved");
            },
            onBatchSettled: (size) => {
              capiFilter.tick(size);
            },
            onBatchError: (error, size) => {
              if (causedByStop(error)) {
                return;
              }
              capiFilter.count("failed");
              // Whether a failed batch costs the run anything depends on what is
              // downstream of it. With the per-story MAPI fetch still to come,
              // its stories pass through undecided and are settled exactly as
              // they would have been without the flag: the result set is
              // complete, so the run is a success and must exit 0. A script
              // doing `find > out.jsonl || exit` would otherwise throw away a
              // correct answer. Without that fetch (`--skip-content`, or the
              // reference scan, where CAPI *is* the content source) the stories
              // in the batch really are decided on less, so it is a real
              // failure. The summary reports the count either way.
              if (skipContent) {
                handleError(error, verbose, { batchSize: size });
              } else {
                logOnlyError(error, { batchSize: size });
              }
            },
          }),
        ]
      : []),
    ...(skipContent
      ? []
      : [
          fetchStoryStream({
            spaceId,
            onIncrement: () => {
              content.tick();
            },
            onStorySuccess: () => {
              content.count("succeeded");
            },
            onStoryError: (error, story) => {
              if (causedByStop(error)) {
                return;
              }
              content.count("failed");
              handleError(error, verbose, { storyId: story.id });
            },
          }),
        ]),
    filterStoriesStream({
      filters,
      // A story the CAPI filter matched is a match: the same expressions have
      // already been evaluated against its content, upstream.
      isAlreadyMatched: matchedByCapiFilter
        ? (story) => matchedByCapiFilter.has(story.id)
        : undefined,
      onIncrement: () => {
        processed.tick();
      },
      onMatch: () => {
        processed.count("succeeded");
      },
      onSkip: () => {
        processed.count("skipped");
      },
      onStoryError: (error, story) => {
        if (causedByStop(error)) {
          return;
        }
        processed.count("failed");
        handleError(error, verbose, { storyId: story.id });
      },
    }),
    sink,
  ];

  await pipeline(stages, { signal });
}

async function runFind({
  spaceId,
  params,
  preContentFilters,
  filters,
  skipContent = false,
  capi,
  ui,
  logger,
  reporter,
  verbose,
}: FindContext & {
  preContentFilters: ClientFilter[];
  filters: ClientFilter[];
  skipContent?: boolean;
  capi?: CapiFilter;
}): Promise<void> {
  const output = createJsonlOutput();
  const tracker = createPhaseTracker({
    ui,
    phases: findPhases({
      capi: capi !== undefined,
      skipContent,
      capiLabel: "Filtering via CAPI",
      // What the last stage still decides depends on the stages before it: with
      // no content fetch and no filter it only writes, and under the CAPI filter
      // it tests just the stories the CDN could not settle.
      processLabel: processStageName({ skipContent, capi: capi !== undefined, filters }),
    }),
  });
  let earlyExit = false;

  try {
    await runStoryPipeline({
      spaceId,
      params,
      preContentFilters,
      filters,
      tracker,
      sink: output.sink,
      capi,
      skipContent,
      signal: output.signal,
      logger,
      verbose,
    });
  } catch (error) {
    // `find | head -5` is a complete, successful use of the command, not a
    // failure: the reader got what it asked for and left. Everything below still
    // runs, so the summary on stderr reports what the run managed to do.
    if (!isDownstreamClosed(error)) {
      throw error;
    }
    earlyExit = true;
  } finally {
    tracker.stop();
    output.close();

    const list = tracker.counts("list");
    const capiFilter = tracker.counts("capiFilter");
    const content = tracker.counts("content");
    const filtered = tracker.counts("process");
    ui.br();
    ui.info(resultsHeadline({ tracker, filters, skipContent, capi: capi !== undefined }));

    // A deliberate stop, so it reports as one. The counts below describe a
    // partial scan and would otherwise read as "this is all there was", and
    // anything less explicit than "not an error" reads as one next to them.
    if (earlyExit) {
      ui.ok(
        "Stopped early on purpose: the command reading this output took what it needed and closed the pipe. " +
          "This is not an error — the run exits 0. The counts below cover only the part of the scope that ran.",
      );
    }

    // An empty result under a bare `--skip-content` is ambiguous: the filters
    // genuinely matched nothing, or they were written against the content that
    // was never fetched. Only the user can tell the two apart, so name the
    // possibility exactly when it applies rather than rejecting the combination.
    if (skipContent && !capi && filters.length > 0 && filtered.succeeded === 0) {
      ui.warn(
        "--where cannot match on story content while --skip-content is set: the listing carries " +
          "story metadata only (full_slug, updated_at, content_type, tag_list, published, …). " +
          "If the expression reads content, drop --skip-content, and add --capi-filter to keep the run fast.",
      );
    }

    // Under `--capi-filter` alone an undecided story still gets fetched and
    // tested; with `--skip-content` there is no fetch left to settle it, so it
    // is dropped on metadata alone. Silent loss is the one outcome that would
    // make the result set wrong without saying so.
    if (skipContent && capi && capiFilter.unresolved > 0) {
      ui.warn(
        `${capiFilter.unresolved} stor${capiFilter.unresolved === 1 ? "y" : "ies"} could not be decided from CDN content ` +
          "(folders, stories the CDN holds no content for, or a failed batch) and were tested on list metadata only. " +
          "Drop --skip-content to fetch and test those from MAPI instead.",
      );
    }

    const lines = [
      `Listing stories: ${list.succeeded}/${list.total} listed, ${list.skipped} skipped before fetch, ${list.failed} page(s) failed. (${tracker.phase("list").mark()})`,
    ];
    if (capi) {
      lines.push(
        `Filtering via CAPI: ${capiFilter.candidates}/${capiFilter.total} candidates, ${capiFilter.pruned} pruned before fetch, ${capiFilter.unresolved} undecided, ${capiFilter.failed} batch(es) failed. (${tracker.phase("capiFilter").mark()})`,
      );
    }
    if (!skipContent) {
      lines.push(
        `Fetching content: ${content.succeeded}/${content.total} succeeded, ${content.failed} failed. (${tracker.phase("content").mark()})`,
      );
    }
    const processName = processStageName({ skipContent, capi: capi !== undefined, filters });
    lines.push(
      `${processName}: ${filtered.succeeded}/${filtered.total} matched, ${filtered.skipped} skipped, ${filtered.failed} failed. (${tracker.phase("process").mark()})`,
    );
    ui.list(lines);

    const timings = tracker.timings();
    logger.info("Finding stories finished", {
      list,
      capiFilter,
      content,
      process: filtered,
      timings,
      skipContent,
      capi: !!capi,
    });
    reporter.addMeta("phaseTimingsMs", { ...timings, total: tracker.elapsedMs() });
    reporter.addSummary("listStoriesResults", toPhaseSummary(list));
    if (capi) {
      // `succeeded` is what survived to a MAPI fetch, `skipped` what the
      // CAPI filter saved: the two numbers the optimization is judged on.
      reporter.addSummary("capiFilterResults", {
        total: capiFilter.total,
        succeeded: capiFilter.candidates + capiFilter.unresolved,
        skipped: capiFilter.pruned,
        failed: capiFilter.failed,
      });
    }
    if (!skipContent) {
      reporter.addSummary("fetchContentResults", toPhaseSummary(content));
    }
    reporter.addSummary("filterResults", {
      total: filtered.total,
      succeeded: filtered.succeeded,
      skipped: filtered.skipped,
      failed: filtered.failed,
    });
    reporter.finalize();
  }
}

/**
 * Names the terminal stage after the work it is actually left with.
 *
 * `--skip-content` usually leaves it nothing to decide, but a metadata-only
 * `--where` is still evaluated there, so the stage is only "writing" when no
 * filter reaches it.
 */
function processStageName({
  skipContent,
  capi,
  filters,
}: {
  skipContent: boolean;
  capi: boolean;
  filters: ClientFilter[];
}): string {
  if (skipContent) {
    if (capi) {
      return "Collecting matches";
    }
    return filters.length > 0 ? "Applying client-side filters" : "Writing results";
  }
  return capi ? "Collecting matches" : "Applying client-side filters";
}

/** One line naming what the run cost and what it saved, per optimization in play. */
function resultsHeadline({
  tracker,
  filters,
  skipContent,
  capi,
}: {
  tracker: PhaseTracker;
  filters: ClientFilter[];
  skipContent: boolean;
  capi: boolean;
}): string {
  const list = tracker.counts("list");
  const capiFilter = tracker.counts("capiFilter");
  const content = tracker.counts("content");
  const filtered = tracker.counts("process");

  if (skipContent) {
    if (capi) {
      return `Results: ${filtered.succeeded} stories matched (${list.succeeded} listed, decided on CDN content, no story fetched from MAPI)`;
    }
    return filters.length > 0
      ? `Results: ${filtered.succeeded} stories matched (${filtered.total} listed, no content fetched)`
      : `Results: ${filtered.succeeded} stories found (metadata only, no content fetched)`;
  }
  if (capi) {
    return `Results: ${filtered.succeeded} stories matched (${content.succeeded} of ${list.succeeded} listed fetched from MAPI, ${capiFilter.pruned} pruned by the CAPI filter)`;
  }
  if (filters.length > 0) {
    return `Results: ${filtered.succeeded} stories matched (${content.succeeded} fetched, ${list.skipped + filtered.skipped} filtered out client-side)`;
  }
  return `Results: ${filtered.succeeded} stories found`;
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
  capi,
  ui,
  logger,
  reporter,
  verbose,
}: FindContext & {
  publishStatusFilters: ClientFilter[];
  whereFilters: ClientFilter[];
  /** Bulk content source in place of the per-story MAPI fetch. */
  capi?: CapiFilter;
}): Promise<void> {
  // Said before the scan rather than after it: the gap changes what a clean
  // report means, and it is cheap to act on while nothing has been read yet.
  //
  // CDN content omits every `<field>__i18n__<lang>` key, so a reference held in
  // a field-level translation is not in the document this scan sees — including
  // whole nested blocks under a translated `bloks` field. `extractReferences`
  // matches those fields by their base name when reading MAPI content, and that
  // handling has nothing to work with here.
  if (capi) {
    ui.warn(
      "References inside field-level translations are not checked under --capi-filter: CDN content " +
        "omits every `<field>__i18n__<lang>` key, so references held in a translated field — including " +
        "whole blocks nested under one — are invisible to the scan. Drop --capi-filter to read every " +
        "story from the Management API instead.",
    );
  }

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

  const output = createJsonlOutput();
  const tracker = createPhaseTracker({
    ui,
    phases: findPhases({
      capi: capi !== undefined,
      // The CAPI stage already carries each story's content, so the per-story
      // MAPI fetch has nothing left to add and is dropped entirely.
      skipContent: capi !== undefined,
      capiLabel: "Reading content via CAPI",
      processLabel: "Checking references",
    }),
  });
  const uuidToMeta = new Map<string, TargetMeta>();
  const candidates: ReferenceCandidate[] = [];
  let earlyExit = false;
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
      tracker,
      capi,
      skipContent: capi !== undefined,
      // Index from the list phase: it already carries `full_slug` and
      // `published`, it covers every story in scope rather than only the
      // filtered ones, and it stays complete even if a content fetch fails —
      // all three keep resolvable references out of the `by_uuids` lookup below.
      onListed: (story) => {
        if (story.uuid) {
          uuidToMeta.set(story.uuid, toTargetMeta(story));
        }
      },
      // Buffered rather than written straight out: an issue cannot be decided
      // until the whole scope has been listed, because deciding one needs the
      // *target's* current slug and publish state. This is the one mode of the
      // command that does not stream — see the emit below.
      sink: createCollectingSink<Story>((story) => {
        checked += 1;
        const refs = extractReferences(story, relationFieldMap);
        // A story with no references can never have a reference issue, so it is
        // counted as checked but never buffered — full story content dominates
        // memory on a large space.
        if (refs.length > 0) {
          candidates.push({ story, refs });
        }
      }),
      signal: output.signal,
      logger,
      verbose,
    });

    tracker.stop();

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

    /** The buffered matches, decided one at a time as the sink asks for them. */
    function* reportIssues(): Generator<Story> {
      for (const { story, refs } of candidates) {
        const issues = detectIssues(refs, uuidToMeta);
        if (issues.length === 0) {
          continue;
        }
        const enriched: Story & { _ref_issues: RefIssue[] } = { ...story, _ref_issues: issues };
        if (!applyClientFilters(enriched, whereFilters)) {
          continue;
        }
        matched += 1;
        yield enriched;
      }
    }

    // Written through the sink rather than in a loop of its own, for the two
    // properties that come with it: a slow reader paces the emit instead of
    // having it buffered ahead of them, and a reader that leaves stops it — a
    // plain loop would go on deciding every remaining candidate and counting
    // matches nobody ever received.
    await pipeline(Readable.from(reportIssues()), output.sink, { signal: output.signal });
  } catch (error) {
    // Same contract as `find`: a reader that has taken what it wanted and left
    // ends the run cleanly. See `runFind`.
    if (!isDownstreamClosed(error)) {
      throw error;
    }
    earlyExit = true;
  } finally {
    tracker.stop();
    output.close();

    const list = tracker.counts("list");
    const capiFilter = tracker.counts("capiFilter");
    const content = tracker.counts("content");
    ui.br();
    ui.info(
      `Results: ${matched} stories with reference issues (${checked} checked, ${externalTargets} external targets resolved)`,
    );

    if (earlyExit) {
      ui.ok(
        "Stopped early on purpose: the command reading this output took what it needed and closed the pipe. " +
          "This is not an error — the run exits 0. The counts below cover only the part of the scope that ran.",
      );
    }

    // A story the CDN holds no content for is checked with nothing in hand, so
    // it can only ever report "no references". Saying how many keeps a clean
    // report from reading as a clean space.
    if (capi && capiFilter.unresolved > 0) {
      ui.warn(
        `${capiFilter.unresolved} stor${capiFilter.unresolved === 1 ? "y" : "ies"} had no CDN content ` +
          "(folders, stories the CDN holds none for, or a failed batch) and were checked without content. " +
          "Drop --capi-filter to read every story from MAPI instead.",
      );
    }

    ui.list([
      `Listing stories: ${list.succeeded}/${list.total} listed, ${list.skipped} skipped before fetch, ${list.failed} page(s) failed. (${tracker.phase("list").mark()})`,
      capi
        ? `Reading content via CAPI: ${capiFilter.candidates}/${capiFilter.total} resolved, ${capiFilter.unresolved} without content, ${capiFilter.failed} batch(es) failed. (${tracker.phase("capiFilter").mark()})`
        : `Fetching content: ${content.succeeded}/${content.total} succeeded, ${content.failed} failed. (${tracker.phase("content").mark()})`,
      `Checking references: ${checked} checked, ${candidates.length} with references, ${matched} with issues. (${tracker.phase("process").mark()})`,
      `Resolving + detecting: ${externalTargets} external targets. (${formatMark(tracker.elapsedMs())})`,
    ]);

    const timings = tracker.timings();
    reporter.addMeta("phaseTimingsMs", { ...timings, total: tracker.elapsedMs() });
    logger.info("Reference check finished", {
      list,
      capiFilter,
      content,
      timings,
      checked,
      withReferences: candidates.length,
      issues: matched,
      externalTargets,
    });
    reporter.addSummary("listStoriesResults", toPhaseSummary(list));
    reporter.addSummary(
      "fetchContentResults",
      capi
        ? {
            total: capiFilter.total,
            succeeded: capiFilter.candidates,
            failed: capiFilter.unresolved,
          }
        : toPhaseSummary(content),
    );
    reporter.addSummary("referenceCheckResults", {
      total: checked,
      succeeded: checked - matched,
      failed: matched,
    });
    reporter.finalize();
  }
}
