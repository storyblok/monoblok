import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  createCollectingSink,
  createJsonlOutput,
  createPhaseTracker,
  formatMark,
  isDownstreamClosed,
  toPhaseSummary,
} from "../../../lib/pipe";
import { fetchComponents } from "../../components/pull/actions";
import { applyClientFilters, resolveReferenceTargets } from "./actions";
import { buildRelationFieldMap, detectIssues, extractReferences, toTargetMeta } from "./references";
import type { RefEntry, RefIssue, TargetMeta } from "./references";
import { findPhases } from "./phases";
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
