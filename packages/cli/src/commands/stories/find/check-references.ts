import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  createCollectingSink,
  createPhaseTracker,
  createResultOutput,
  formatDuration,
  isDeliberateStop,
  isLimitReached,
  toPhaseSummary,
} from "../../../lib/pipe";
import { renderRunSummary } from "../../../lib/ui";
import { fetchComponents } from "../../components/pull/actions";
import { applyClientFilters, resolveReferenceTargets } from "./actions";
import { REF_ISSUE_COLUMNS } from "./columns";
import { buildRelationFieldMap, detectIssues, extractReferences, toTargetMeta } from "./references";
import type { IssueType, RefEntry, RefIssue, TargetMeta } from "./references";
import {
  findPhases,
  contentSummary,
  listingSummary,
  storiesCount,
  stoppedEarlyMessage,
} from "./phases";
import { runStoryPipeline } from "./pipeline";
import type { CapiFilter } from "./pipeline";
import type { ClientFilter, FindContext } from "./types";
import type { Story } from "../constants";

type ReferenceCandidate = {
  story: Story;
  refs: RefEntry[];
};

export async function runCheckReferences({
  spaceId,
  params,
  publishStatusFilters,
  whereFilters,
  issueTypes,
  limit,
  capi,
  ui,
  logger,
  reporter,
  verbose,
}: FindContext & {
  publishStatusFilters: ClientFilter[];
  whereFilters: ClientFilter[];
  /** The issue types to report; a story with none of them is left out. */
  issueTypes: Set<IssueType>;
  /**
   * Caps the stories reported, not the stories scanned.
   *
   * A reference is only decidable once every target is known, so the scan has to
   * read the whole scope whichever way the limit is set. It bounds the report.
   */
  limit?: number;
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

  const output = createResultOutput({ columns: REF_ISSUE_COLUMNS, limit });
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
  let stoppedByLimit = false;
  let checked = 0;
  let externalTargets = 0;
  /** When the post-listing step began, which only the pipeline finishing starts. */
  let resolveStartedAt: number | undefined;
  const checking = tracker.phase("process");

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
      // Timed as part of the last stage: extracting references is the check,
      // and the stage above it only passes stories through.
      sink: createCollectingSink<Story>((story) => {
        checking.start();
        checked += 1;
        const refs = extractReferences(story, relationFieldMap);
        // A story with no references can never have a reference issue, so it is
        // counted as checked but never buffered — full story content dominates
        // memory on a large space.
        if (refs.length > 0) {
          candidates.push({ story, refs });
        }
        checking.finish();
      }),
      signal: output.signal,
      logger,
      verbose,
    });

    tracker.stop();
    resolveStartedAt = performance.now();

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
        const issues = detectIssues(refs, uuidToMeta).filter((issue) => issueTypes.has(issue.type));
        if (issues.length === 0) {
          continue;
        }
        const enriched: Story & { _ref_issues: RefIssue[] } = { ...story, _ref_issues: issues };
        if (!applyClientFilters(enriched, whereFilters)) {
          continue;
        }
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
    // Same contract as `find`: `--limit` and a reader that leaves both end the run at 0.
    if (!isDeliberateStop(error)) {
      throw error;
    }
    earlyExit = true;
    stoppedByLimit = isLimitReached(error);
  } finally {
    tracker.stop();
    output.close();
    await output.flush();

    // Counted at the sink, so a story decided while an early stop tears the
    // pipeline down is not reported as a result nobody received.
    const matched = output.written;

    const list = tracker.counts("list");
    const capiFilter = tracker.counts("capiFilter");
    const content = tracker.counts("content");
    ui.br();
    for (const line of renderRunSummary({
      headline: `Found ${storiesCount(matched)} with reference issues`,
      duration: formatDuration(tracker.elapsedMs()),
      failed: list.failed > 0,
      qualifier: list.failed > 0 ? "incomplete, part of the space could not be listed" : undefined,
      stages: [
        listingSummary(tracker),
        capi
          ? {
              label: "CAPI content",
              result: `${capiFilter.candidates} read`,
              notes: [
                {
                  count: capiFilter.failed,
                  text: ["batch failed", "batches failed"],
                  failure: true,
                },
              ],
              duration: tracker.phase("capiFilter").duration(),
            }
          : contentSummary(tracker),
        {
          label: "Checking references",
          result: `${checked} checked`,
          notes: [{ count: candidates.length, text: "with references" }],
          duration: tracker.phase("process").duration(),
        },
        {
          label: "Resolving targets",
          result: `${externalTargets} external`,
          duration: formatDuration(
            resolveStartedAt === undefined ? 0 : performance.now() - resolveStartedAt,
          ),
        },
      ],
    })) {
      ui.log(line);
    }

    // Printed under the summary, so they are not lost above it.
    if (earlyExit || (capi && capiFilter.unresolved > 0)) {
      ui.br();
    }
    if (earlyExit) {
      ui.ok(stoppedEarlyMessage(stoppedByLimit ? limit : undefined));
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
