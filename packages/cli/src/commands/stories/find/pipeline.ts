import type { Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { RegionCode } from "../../../constants";
import type { UI } from "../../../lib/ui";
import { isDownstreamClosed } from "../../../lib/pipe";
import type { PhaseTracker } from "../../../lib/pipe";
import { fetchStoriesStream, fetchStoryStream } from "../streams";
import { handleError, logOnlyError } from "../../../utils/error/error";
import { capiFilterStream, filterListedStoriesStream, filterStoriesStream } from "./streams";
import { CAPI_BATCH_SIZE, createCapiContentFetcher, parseCapiParams } from "./capi";
import type { CapiContentFetcher } from "./capi";
import type { ClientFilter, FindContext } from "./types";
import type { Story } from "../constants";

/** Everything the CAPI filter stage needs, resolved before the first page is listed. */
export type CapiFilter = {
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
export async function prepareCapiFilter({
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
  ui: UI;
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
export async function runStoryPipeline({
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
