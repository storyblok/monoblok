import type { Command } from "commander";
import { ClientError } from "@storyblok/management-api-client";
import type { StrataSearchHit } from "@storyblok/api-client";
import { getMapiClient } from "../../../api";
import type { TableColumn, UI } from "../../../lib/ui";
import { CommandError } from "../../../utils/error/command-error";
import { isRecord } from "../../../utils/object";
import type { Story } from "../constants";
import { buildStoryScopeParams } from "../query-params";
import { parsePublishStatuses, splitList } from "./actions";
import { STORY_COLUMNS } from "./columns";
import type { FindOptions } from "./types";

/** Strata returns a single page of at most this many hits; there is no pagination. */
export const STRATA_MAX_LIMIT = 100;

/** Strata's lower cap once `starts_with` or `content_type` narrows the search. */
export const STRATA_MAX_SCOPED_LIMIT = 50;

export type StrataQuery = {
  q: string;
  version: "draft" | "published";
  limit: number;
  starts_with?: string;
  content_type?: string;
};

/** Where a story ranked, and the content that matched. */
export type SemanticMatch = {
  score: number;
  excerpt: string;
};

/**
 * Strata's answer, one entry per story.
 *
 * A story can match more than once, one hit per matching piece of content, and
 * Strata ranks best match first, so a story's first hit is its best one.
 */
export type SemanticRanking = Map<Story["id"], SemanticMatch>;

export type RankedStory = Story & { _score: number; _excerpt: string };

export const SEMANTIC_STORY_COLUMNS: TableColumn<RankedStory>[] = [
  ...STORY_COLUMNS,
  { header: "score", value: (story) => story._score.toFixed(2) },
  { header: "excerpt", value: (story) => story._excerpt.replace(/\s+/g, " "), flexible: true },
];

/**
 * Flags that cannot compose with Strata's results, keyed by their option
 * attribute name, and why.
 *
 * Strata answers with one ranked page of at most 100 hits. A flag that reorders
 * that page, or that needs the whole space in scope, would answer a different
 * question than the one asked, so it is rejected rather than ignored.
 */
const SEMANTIC_INCOMPATIBLE_OPTIONS: Record<string, string> = {
  sort: "results keep Strata's relevance order",
  checkReferences: "the reference check reads every story in scope, not Strata's matches",
  capiFilter:
    "Strata returns at most 100 hits, so there is nothing to prune ahead of the Management API fetch",
  capiParams:
    "semantic mode searches the draft, like the stories it prints; filter by status with --publish-status",
  entryType: "Strata only searches stories, never folders",
};

const isSemanticCompatible = (attributeName: string): boolean =>
  !Object.hasOwn(SEMANTIC_INCOMPATIBLE_OPTIONS, attributeName);

/**
 * Rejects every incompatible flag that was set, wherever it was set: on the
 * command line, or in a config file, which would otherwise fail the run with no
 * flag in sight. A value left at its default was never asked for.
 */
export function assertSemanticCompatibleOptions(command: Command): void {
  const reasons = command.options.flatMap((option) => {
    const name = option.attributeName();
    const source = command.getOptionValueSource(name);
    // Config resolution hydrates every option, defaults included, under the
    // `config` source, so a config value only counts when it is not the default.
    const isDefault =
      source === undefined ||
      source === "default" ||
      (source === "config" && command.getOptionValue(name) === option.defaultValue);
    if (isSemanticCompatible(name) || isDefault) {
      return [];
    }
    const origin = source === "cli" ? "" : ` (set from ${source})`;
    return [
      `${option.long}${origin} is not compatible with --mode semantic: ${SEMANTIC_INCOMPATIBLE_OPTIONS[name]}.`,
    ];
  });
  if (reasons.length > 0) {
    throw new CommandError(reasons.join("\n"));
  }
}

/** The command's usual help, listing only the options `--mode semantic` accepts. */
export function formatSemanticHelp(command: Command): string {
  const help = command.createHelp();
  const visibleOptions = help.visibleOptions.bind(help);
  help.visibleOptions = (cmd) =>
    visibleOptions(cmd).filter((option) => isSemanticCompatible(option.attributeName()));
  return `Options compatible with --mode semantic:\n\n${help.formatHelp(command, help)}`;
}

/** Rejects values the compatible flags cannot take in semantic mode, before any request. */
export function assertSemanticOptions(text: string | undefined, options: FindOptions): void {
  if (!text?.trim()) {
    throw new CommandError(
      "--mode semantic needs a search text, e.g. `stories find 'pages about pricing' --mode semantic`.",
    );
  }
  if (options.containerBlock !== undefined && splitList(options.containerBlock).length > 1) {
    throw new CommandError(
      `--mode semantic accepts a single --container-block, and got: ${options.containerBlock}`,
    );
  }
}

/**
 * Picks the content version Strata searches.
 *
 * The draft, like the Management API stories the command prints, and like the
 * full-text search. The one exception changes no result: stories that are only
 * `published` have the same draft and published content, so searching the
 * published version finds the same matches, without drafts taking up slots of
 * Strata's single page only to be filtered out afterwards.
 */
function strataVersion(publishStatus: string | undefined): StrataQuery["version"] {
  if (publishStatus === undefined) {
    return "draft";
  }
  const statuses = new Set(parsePublishStatuses(publishStatus));
  return statuses.size === 1 && statuses.has("published") ? "published" : "draft";
}

/**
 * Builds the Strata query from the flags it can take.
 *
 * `--starts-with` and `--container-block` are pushed down, so they narrow what
 * Strata ranks rather than what survives of its page. Every other filter runs on
 * the hydrated stories, like in a full-text run.
 *
 * Strata's page is always requested at its largest. Its `limit` counts hits, and a
 * story can be several hits, so it cannot stand in for `--limit`, which counts
 * results. The largest page also leaves the most matches for the local filters.
 *
 * The version is the draft, unless `--publish-status published` alone makes the
 * published one equivalent: see {@link strataVersion}.
 */
export function buildStrataQuery(text: string, options: FindOptions): StrataQuery {
  const { starts_with: startsWith } = buildStoryScopeParams({ startsWith: options.startsWith });
  if (options.startsWith !== undefined && startsWith === undefined) {
    throw new CommandError(
      `--starts-with expects a slug prefix, e.g. 'en/blog', and got: ${JSON.stringify(options.startsWith)}`,
    );
  }
  const contentType =
    options.containerBlock !== undefined ? splitList(options.containerBlock)[0] : undefined;
  const scoped = startsWith !== undefined || contentType !== undefined;

  return {
    q: text.trim(),
    version: strataVersion(options.publishStatus),
    limit: scoped ? STRATA_MAX_SCOPED_LIMIT : STRATA_MAX_LIMIT,
    ...(startsWith === undefined ? {} : { starts_with: startsWith }),
    ...(contentType === undefined ? {} : { content_type: contentType }),
  };
}

/** Collapses Strata's hits to one per story, keeping each story's best one. */
export function rankHits(hits: StrataSearchHit[]): SemanticRanking {
  const ranking: SemanticRanking = new Map();
  for (const { story, score, excerpt } of hits) {
    if (!ranking.has(story.id)) {
      ranking.set(story.id, { score, excerpt });
    }
  }
  return ranking;
}

/**
 * Orders listed stories by their Strata rank and annotates each with it.
 *
 * A ranked story the listing did not return (filtered out server-side, or no
 * longer there) is simply absent.
 */
export function* orderByRank(stories: Story[], ranking: SemanticRanking): Generator<RankedStory> {
  const byId = new Map(stories.map((story) => [story.id, story]));
  for (const [id, { score, excerpt }] of ranking) {
    const story = byId.get(id);
    if (story) {
      yield { ...story, _score: score, _excerpt: excerpt };
    }
  }
}

/** Reads Strata's `{ error: { code, message } }` body, if the response carries one. */
function describeStrataError(data: unknown): string | undefined {
  if (!isRecord(data) || !isRecord(data.error)) {
    return undefined;
  }
  const { code, message } = data.error;
  return [code, message].filter((part) => typeof part === "string" && part).join(": ");
}

/**
 * Runs the Strata search through the Management API, as the logged-in user.
 *
 * The search honours the user's permissions, so it only matches stories the
 * user can read, like every other request the command makes. It searches the
 * draft or the published version alike, with no token beyond the login.
 */
export async function searchStrata({
  spaceId,
  query,
  ui,
}: {
  spaceId: string;
  query: StrataQuery;
  ui: UI;
}): Promise<SemanticRanking> {
  const spinner = ui.createSpinner("Searching with Strata...");
  try {
    const { data } = await getMapiClient().get<{ results: StrataSearchHit[] }>(
      `/v1/spaces/${spaceId}/strata/search`,
      { query, throwOnError: true },
    );
    const hits = data?.results ?? [];

    const ranking = rankHits(hits);
    spinner.succeed(
      `Strata matched ${pluralize(ranking.size, "story", "stories")} (${pluralize(hits.length, "hit", "hits")})`,
    );
    return ranking;
  } catch (error) {
    spinner.failed("Strata search failed");
    throw toStrataError(error);
  }
}

const pluralize = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

/**
 * Names Strata's reason for a rejected search, e.g. `feature_disabled` when
 * Strata is off for the space, which the bare HTTP status does not tell apart.
 */
function toStrataError(error: unknown): unknown {
  if (!(error instanceof ClientError) || error.response.status === 0) {
    return error;
  }
  const { status, data } = error.response;
  const reason = describeStrataError(data);
  const message = `Strata search failed (HTTP ${status})${reason ? `: ${reason}` : ""}`;
  // A 400 is the query itself: a usage error, like any other rejected flag value.
  return status === 400 ? new CommandError(message) : new Error(message);
}
