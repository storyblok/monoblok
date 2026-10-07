import { formatDuration } from "../../../lib/pipe";
import type { PhaseDefinition, PhaseTracker } from "../../../lib/pipe";
import { renderRunSummary } from "../../../lib/ui";
import type { SummaryStage } from "../../../lib/ui";
import type { ClientFilter } from "./types";

/**
 * The phases of a find run, in pipeline order.
 *
 * Which of them exist depends on the flags — `--skip-content` removes the content
 * fetch, `--capi-filter` adds a bulk stage ahead of it — and each declares what
 * it loses, which is what keeps every total below it honest as stories are
 * dropped along the way. The tracker owns the bars, the counters and the
 * timings from here on.
 */
export function findPhases({
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
 * Names the terminal stage after the work it is actually left with.
 *
 * `--skip-content` usually leaves it nothing to decide, but a metadata-only
 * `--where` is still evaluated there, so the stage is only "writing" when no
 * filter reaches it.
 */
export function processStageName({
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

/** `1 story`, `210 stories`. */
export const storiesCount = (count: number): string =>
  `${count} ${count === 1 ? "story" : "stories"}`;

/**
 * The find run's summary: what it found, how long it took, and what each stage
 * did on the way.
 *
 * The last stage only gets a row when it decided something. With no filter left
 * for it, it passes every story through, and a row saying so is noise.
 */
export function findSummary({
  results,
  tracker,
  filters,
  skipContent,
  capi,
}: {
  /** Lines actually written, which is what a reader of stdout received. */
  results: number;
  tracker: PhaseTracker;
  filters: ClientFilter[];
  skipContent: boolean;
  capi: boolean;
}): string[] {
  const list = tracker.counts("list");
  const capiFilter = tracker.counts("capiFilter");
  const filtered = tracker.counts("process");

  const stages = [listingSummary(tracker)];
  if (capi) {
    stages.push({
      label: "CAPI filter",
      // A story the CDN could not decide is passed on like a match: the stage
      // only ever prunes, and the next one decides it.
      result: `${capiFilter.candidates + capiFilter.unresolved} passed`,
      notes: [
        { count: capiFilter.pruned, text: "pruned" },
        // With the MAPI fetch still to come, a failed batch costs time but
        // loses nothing: its stories are decided there instead.
        {
          count: capiFilter.failed,
          text: ["batch failed", "batches failed"],
          failure: skipContent,
        },
      ],
      duration: tracker.phase("capiFilter").duration(),
    });
  }
  if (!skipContent) {
    stages.push(contentSummary(tracker));
  }
  if (capi || filters.length > 0) {
    stages.push({
      label: "Filtering",
      result: `${filtered.succeeded} matched`,
      notes: [
        { count: filtered.skipped, text: "filtered out" },
        { count: filtered.failed, text: "failed", failure: true },
      ],
      duration: tracker.phase("process").duration(),
    });
  }

  return renderRunSummary({
    headline: `Found ${storiesCount(results)}`,
    duration: formatDuration(tracker.elapsedMs()),
    // A failed listing page means part of the scope was never seen.
    failed: list.failed > 0,
    qualifier:
      list.failed > 0
        ? "incomplete, part of the space could not be listed"
        : skipContent && !capi
          ? "metadata only, no content fetched"
          : undefined,
    stages,
  });
}

/**
 * Reports a deliberate stop as one: the counts that follow describe a partial
 * scan, and anything less explicit than "not an error" reads as one next to them.
 */
export function stoppedEarlyMessage(limit: number | undefined): string {
  return (
    (limit !== undefined
      ? `Stopped early on purpose: --limit ${limit} was reached, so the rest of the scope was left unread. `
      : "Stopped early on purpose: the command reading this output took what it needed and closed the pipe. ") +
    "This is not an error — the run exits 0. The counts below cover only the part of the scope that ran."
  );
}

/** The content phase's row in the run summary. */
export function contentSummary(tracker: PhaseTracker): SummaryStage {
  const content = tracker.counts("content");
  return {
    label: "Fetching content",
    result: `${content.succeeded} fetched`,
    notes: [{ count: content.failed, text: "failed", failure: true }],
    duration: tracker.phase("content").duration(),
  };
}

/** The listing phase's row in the run summary, the same in every mode. */
export function listingSummary(tracker: PhaseTracker): SummaryStage {
  const list = tracker.counts("list");
  return {
    label: "Listing stories",
    result: `${list.succeeded} listed`,
    notes: [
      { count: list.skipped, text: "filtered out" },
      { count: list.failed, text: ["page failed", "pages failed"], failure: true },
    ],
    duration: tracker.phase("list").duration(),
  };
}
