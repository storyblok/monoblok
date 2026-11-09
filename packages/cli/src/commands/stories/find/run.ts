import {
  createPhaseTracker,
  createResultOutput,
  isDeliberateStop,
  isLimitReached,
  toPhaseSummary,
} from "../../../lib/pipe";
import {
  findPhases,
  findSummary,
  processStageName,
  stoppedEarlyMessage,
  storiesCount,
} from "./phases";
import { STORY_COLUMNS } from "./columns";
import { runStoryPipeline } from "./pipeline";
import type { CapiFilter } from "./pipeline";
import { orderByRank, SEMANTIC_STORY_COLUMNS } from "./semantic";
import type { SemanticRanking } from "./semantic";
import type { ClientFilter, FindContext } from "./types";

export async function runFind({
  spaceId,
  params,
  preContentFilters,
  filters,
  skipContent = false,
  limit,
  capi,
  ranking,
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
  /**
   * Strata's ranking, for `--mode semantic`. `params` then lists exactly the
   * ranked stories, which are fetched and emitted in rank order rather than as
   * listed, so `limit` keeps the best matches.
   */
  ranking?: SemanticRanking;
}): Promise<void> {
  const output = ranking
    ? createResultOutput({ columns: SEMANTIC_STORY_COLUMNS, limit })
    : createResultOutput({ columns: STORY_COLUMNS, limit });
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
    // An empty `by_ids` would list the whole space, so no hits means no listing.
    if (!ranking || ranking.size > 0) {
      await runStoryPipeline({
        spaceId,
        params,
        preContentFilters,
        filters,
        tracker,
        sink: output.sink,
        capi,
        orderListed: ranking ? (stories) => orderByRank(stories, ranking) : undefined,
        skipContent,
        signal: output.signal,
        logger,
        verbose,
      });
    }
  } catch (error) {
    // `find | head -5` and `find --limit 5` are both complete, successful uses of
    // the command rather than failures: the results asked for were produced, and
    // the rest of the scope was never worth walking. Everything below still runs,
    // so the summary on stderr reports what the run managed to do.
    // Once the run has been stopped on purpose, whichever stream reports the
    // teardown first decides what `pipeline()` rejects with — a buffered stage
    // flushing as the stop lands surfaces it as a premature close — so the stop
    // itself is what decides, not the error.
    const reason = output.signal.aborted ? output.signal.reason : error;
    if (!isDeliberateStop(error) && !isDeliberateStop(reason)) {
      throw error;
    }
    earlyExit = true;
    stoppedByLimit = isLimitReached(error) || isLimitReached(reason);
  } finally {
    tracker.stop();
    output.close();
    // Taken before the flush, which on a terminal lasts as long as someone
    // reads the table in the pager.
    const elapsedMs = tracker.elapsedMs();
    const timings = tracker.timings();
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
      elapsedMs,
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

    // The summary counts an undecided story as passed, which is only true when a
    // MAPI fetch follows. Without one, a --where on content can never match it,
    // so a real match drops out under a clean summary. Folders are left out: no
    // API has content for one, so a MAPI fetch would not decide it either.
    const missing = capiFilter.unresolved - capiFilter.unresolvedFolders;
    if (skipContent && capi && missing > 0) {
      notes.push(() =>
        ui.warn(
          `${storiesCount(missing)} may be missing from the results. The CDN returned no content ` +
            "to test --where on (stories it does not serve, or a failed request), and --skip-content " +
            "leaves only list metadata, which a --where on content cannot match. Drop --skip-content to test " +
            "them on Management API content.",
        ),
      );
    }

    if (notes.length > 0) {
      ui.br();
      for (const note of notes) {
        note();
      }
    }

    logger.info("Finding stories finished", {
      list,
      capiFilter,
      content,
      process: filtered,
      timings,
      skipContent,
      capi: !!capi,
    });
    reporter.addMeta("phaseTimingsMs", { ...timings, total: elapsedMs });
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
