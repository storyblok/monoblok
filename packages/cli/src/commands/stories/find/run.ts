import {
  createJsonlOutput,
  createPhaseTracker,
  isDownstreamClosed,
  toPhaseSummary,
} from "../../../lib/pipe";
import { findPhases, processStageName, resultsHeadline } from "./phases";
import { runStoryPipeline } from "./pipeline";
import type { CapiFilter } from "./pipeline";
import type { ClientFilter, FindContext } from "./types";

export async function runFind({
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
