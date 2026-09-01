import type { PhaseDefinition, PhaseTracker } from "../../../lib/pipe";
import type { ClientFilter } from "./types";

/**
 * The phases of a find run, in pipeline order.
 *
 * Which of them exist depends on the flags — `--skip-content` removes the content
 * fetch, `--capi-filter` adds a bulk stage ahead of it — and each declares what
 * it loses, which is what keeps every total below it honest as stories are
 * dropped along the way. The tracker owns the bars, the counters and the
 * `done @Xs` marks from here on.
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

/** One line naming what the run cost and what it saved, per optimization in play. */
export function resultsHeadline({
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
