import {
  createPhaseTracker,
  createResultOutput,
  isDeliberateStop,
  isLimitReached,
  toPhaseSummary,
} from "../../../lib/pipe";
import { findPhases, findSummary, processStageName, stoppedEarlyMessage } from "./phases";
import { STORY_COLUMNS } from "./columns";
import { runStoryPipeline } from "./pipeline";
import type { CapiFilter } from "./pipeline";
import type { ClientFilter, FindContext } from "./types";

export async function runFind({
  spaceId,
  params,
  preContentFilters,
  filters,
  skipContent = false,
  limit,
  capi,
  ui,
  logger,
  reporter,
  verbose,
}: FindContext & {
  preContentFilters: ClientFilter[];
  filters: ClientFilter[];
  skipContent?: boolean;
  /** Stop once this many results have been written. */
  limit?: number;
  capi?: CapiFilter;
}): Promise<void> {
  const output = createResultOutput({ columns: STORY_COLUMNS, limit });
  // What the last stage still decides depends on the stages before it: with no
  // content fetch and no filter it only writes, and under the CAPI filter it
  // tests just the stories the CDN could not settle.
  const processName = processStageName({ skipContent, capi: capi !== undefined, filters });
  const tracker = createPhaseTracker({
    ui,
    phases: findPhases({
      capi: capi !== undefined,
      skipContent,
      capiLabel: "Filtering via CAPI",
      processLabel: processName,
    }),
  });
  let earlyExit = false;
  let stoppedByLimit = false;

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
    // `find | head -5` and `find --limit 5` are both complete, successful uses of
    // the command rather than failures: the results asked for were produced, and
    // the rest of the scope was never worth walking. Everything below still runs,
    // so the summary on stderr reports what the run managed to do.
    if (!isDeliberateStop(error)) {
      throw error;
    }
    earlyExit = true;
    stoppedByLimit = isLimitReached(error);
  } finally {
    tracker.stop();
    output.close();
    // On a terminal the results are a table printed once the bars are down,
    // ahead of the summary so the summary is the last thing on screen.
    await output.flush();

    const list = tracker.counts("list");
    const capiFilter = tracker.counts("capiFilter");
    const content = tracker.counts("content");
    const filtered = tracker.counts("process");
    ui.br();
    for (const line of findSummary({
      results: output.written,
      tracker,
      filters,
      skipContent,
      capi: capi !== undefined,
    })) {
      ui.log(line);
    }

    // Printed under the summary, so they are not lost above it.
    const notes: Array<() => void> = [];
    if (earlyExit) {
      notes.push(() => ui.ok(stoppedEarlyMessage(stoppedByLimit ? limit : undefined)));
    }

    // Zero matches here means the filters matched nothing, or were written
    // against content that was never fetched. Only the user can tell which.
    if (skipContent && !capi && filters.length > 0 && filtered.succeeded === 0) {
      notes.push(() =>
        ui.warn(
          "--where sees list metadata only while --skip-content is set (full_slug, updated_at, content_type, " +
            "tag_list, published, …), never story content. If the expression reads content, drop " +
            "--skip-content, and add --capi-filter to keep the run fast.",
        ),
      );
    }

    // The API rejects an unknown sort column on the first page, and the error
    // alone does not name the flag.
    if (list.failed > 0 && params.sort_by) {
      notes.push(() =>
        ui.warn(
          `If the error above is "Not sortable by this column", --sort ${params.sort_by} names a column the API cannot sort by. ` +
            "Use a story column such as updated_at, created_at, published_at, name, slug or position, or a content field with the 'content.' prefix.",
        ),
      );
    }

    if (notes.length > 0) {
      ui.br();
      for (const note of notes) {
        note();
      }
    }

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
