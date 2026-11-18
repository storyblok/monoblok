import type { Command } from "commander";
import { ClientError } from "@storyblok/management-api-client";
import type { StrataSearchHit, StrataSearchQuery } from "@storyblok/management-api-client";
import { getMapiClient } from "../../../api";
import type { TableColumn, UI } from "../../../lib/ui";
import { handleAPIError } from "../../../utils/error/api-error";
import { CommandError } from "../../../utils/error/command-error";
import { isRecord } from "../../../utils/object";
import type { Story } from "../constants";
import { parseLimit, parseList, parsePublishStatuses, parseStartsWith } from "./actions";
import { STORY_COLUMNS } from "./columns";
import type { FindOptions } from "./types";

/** Strata returns a single page of at most this many hits; there is no pagination. */
export const STRATA_MAX_LIMIT = 100;

/** Strata's lower cap once `starts_with` or `content_type` narrows the search. */
export const STRATA_MAX_SCOPED_LIMIT = 50;

/** How many stories a semantic search prints when `--limit` is not set. */
export const SEMANTIC_DEFAULT_LIMIT = 25;

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

export type SemanticSearch = {
  ranking: SemanticRanking;
  /**
   * Strata's page size when the page came back full. Strata has no next page,
   * so more stories may match than it returned.
   */
  fullPageOf?: number;
};

export type RankedStory = Story & { _score: number; _excerpt: string };

/**
 * The excerpt is the only flexible column: it can run to well over a thousand
 * characters, and the name is what identifies the story, so it must not be the
 * column that gives way.
 */
export const SEMANTIC_STORY_COLUMNS: TableColumn<RankedStory>[] = [
  ...STORY_COLUMNS.map((column) => ({ ...column, flexible: false })),
  { header: "score", value: (story) => story._score.toFixed(2) },
  { header: "excerpt", value: (story) => story._excerpt.replace(/\s+/g, " "), flexible: true },
];

/** Why a flag cannot compose with Strata's results, optionally only for some of its values. */
type Incompatibility = { reason: string; values?: readonly string[] };

/**
 * Every `find` option, and whether `--mode semantic` takes it: `null` when it
 * does, or why not.
 *
 * Typed over every option, so a flag added to `find` does not compile until it
 * is classified here. An option missing from it at runtime is rejected, so the
 * list fails closed.
 *
 * Strata answers with one ranked page of at most 100 hits. A flag that reorders
 * that page, or that needs the whole space in scope, would answer a different
 * question than the one asked.
 */
const SEMANTIC_OPTIONS: Record<keyof FindOptions, Incompatibility | null> = {
  space: null,
  mode: null,
  entryType: { reason: "Strata only searches stories, never folders", values: ["folder"] },
  startsWith: null,
  containerBlock: null,
  includesBlock: null,
  query: null,
  where: null,
  tag: null,
  workflowStage: null,
  publishStatus: null,
  created: null,
  updated: null,
  lastPublished: null,
  firstPublished: null,
  scheduled: null,
  sort: { reason: "results keep Strata's relevance order" },
  limit: null,
  references: null,
  checkReferences: {
    reason: "the reference check reads every story in scope, not Strata's matches",
  },
  skipContent: null,
  capiFilter: {
    reason:
      "Strata returns at most 100 hits, so there is nothing to prune ahead of the Management API fetch",
  },
  capiParams: {
    reason:
      "semantic mode searches the draft, like the stories it prints; filter by status with --publish-status",
  },
};

const isSemanticOption = (name: string): name is keyof FindOptions =>
  Object.hasOwn(SEMANTIC_OPTIONS, name);

/** The incompatibility a value runs into, if any. Unknown options fail closed. */
function incompatibilityOf(name: string, value: unknown): Incompatibility | undefined {
  if (!isSemanticOption(name)) {
    return { reason: "it is not supported in semantic mode" };
  }
  const incompatibility = SEMANTIC_OPTIONS[name];
  if (!incompatibility) {
    return undefined;
  }
  if (incompatibility.values && !incompatibility.values.includes(String(value))) {
    return undefined;
  }
  return incompatibility;
}

/** A value that asks for nothing: an off switch, an empty string or list, or the default. */
function isUnset(value: unknown, defaultValue: unknown): boolean {
  return (
    value === undefined ||
    value === false ||
    value === "" ||
    (Array.isArray(value) && value.length === 0) ||
    value === defaultValue
  );
}

/** One line naming every flag, or flag value, that semantic mode turns down. */
function formatUnavailableFlags(command: Command): string {
  const flags = command.options.flatMap((option) => {
    const name = option.attributeName();
    const incompatibility = isSemanticOption(name) ? SEMANTIC_OPTIONS[name] : undefined;
    if (!incompatibility || !option.long) {
      return [];
    }
    return incompatibility.values
      ? incompatibility.values.map((value) => `${option.long} ${value}`)
      : [option.long];
  });
  return `Not available with --mode semantic: ${flags.join(", ")}.`;
}

/**
 * Settles the flags semantic mode cannot take.
 *
 * Set on the command line, one is a usage error that names it. Set in a config
 * file, it is a default for full-text runs, and nothing on the command line
 * could clear it (there is no `--no-sort`), so it is left out of this run
 * instead. Returns the options to run with, and the flags left out.
 */
export function resolveSemanticOptions(
  command: Command,
  options: FindOptions,
): { options: FindOptions; ignored: string[] } {
  const resolved: FindOptions = { ...options };
  const ignored: string[] = [];
  const reasons: string[] = [];
  for (const option of command.options) {
    const name = option.attributeName();
    const value = command.getOptionValue(name);
    if (isUnset(value, option.defaultValue)) {
      continue;
    }
    const incompatibility = incompatibilityOf(name, value);
    if (!incompatibility) {
      continue;
    }
    const flag = incompatibility.values ? `${option.long} ${String(value)}` : `${option.long}`;
    if (command.getOptionValueSource(name) === "cli") {
      reasons.push(`${flag} is not compatible with --mode semantic: ${incompatibility.reason}.`);
    } else {
      ignored.push(flag);
      Reflect.deleteProperty(resolved, name);
    }
  }
  if (reasons.length > 0) {
    throw new CommandError([...reasons, formatUnavailableFlags(command)].join("\n"));
  }
  return { options: resolved, ignored };
}

/** Rejects values the compatible flags cannot take in semantic mode, before any request. */
export function assertSemanticOptions(text: string | undefined, options: FindOptions): void {
  if (!text?.trim()) {
    throw new CommandError(
      "--mode semantic needs a search text, e.g. `stories find 'pages about pricing' --mode semantic`.",
    );
  }
  if (options.containerBlock !== undefined) {
    const blocks = parseList("--container-block", options.containerBlock);
    if (blocks.includes(",")) {
      throw new CommandError(
        `--mode semantic accepts a single --container-block, and got: ${options.containerBlock}`,
      );
    }
  }
}

/**
 * Picks the content version Strata searches.
 *
 * The draft, like the Management API stories the command prints, and like the
 * full-text search. The one exception changes no result: stories that are
 * `published` have the same draft and published content, so searching the
 * published version finds the same ones. It leaves out stories that were never
 * published, so they take no slots of Strata's single page only to be filtered
 * out afterwards. Stories with unpublished changes are still in the published
 * version, and `--publish-status published` drops them after the search.
 */
function strataVersion(publishStatus: string | undefined): StrataSearchQuery["version"] {
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
export function buildStrataQuery(text: string, options: FindOptions): StrataSearchQuery {
  const startsWith =
    options.startsWith === undefined ? undefined : parseStartsWith(options.startsWith);
  const contentType =
    options.containerBlock === undefined
      ? undefined
      : parseList("--container-block", options.containerBlock);
  const scoped = startsWith !== undefined || contentType !== undefined;

  return {
    q: text.trim(),
    version: strataVersion(options.publishStatus),
    limit: scoped ? STRATA_MAX_SCOPED_LIMIT : STRATA_MAX_LIMIT,
    ...(startsWith === undefined ? {} : { starts_with: startsWith }),
    ...(contentType === undefined ? {} : { content_type: contentType }),
  };
}

/**
 * Reads `--limit` for a semantic search.
 *
 * Without it, the search stops at {@link SEMANTIC_DEFAULT_LIMIT} stories, the
 * search endpoint's own default: the best matches, rather than everything down
 * to Strata's weakest. Strata's page
 * is still requested at its largest, so the local filters have the most
 * matches to work with. A limit above that page can never be reached, so it is
 * rejected rather than silently capped.
 */
export function parseSemanticLimit(
  raw: string | undefined,
  query: StrataSearchQuery,
): { limit: number; isDefault: boolean } {
  const limit = parseLimit(raw);
  if (limit === undefined) {
    return { limit: SEMANTIC_DEFAULT_LIMIT, isDefault: true };
  }
  const max = query.limit ?? STRATA_MAX_LIMIT;
  if (limit > max) {
    const scope = max < STRATA_MAX_LIMIT ? " with --starts-with or --container-block" : "";
    throw new CommandError(
      `--limit is at most ${max} with --mode semantic${scope}: Strata returns at most ${max} matches. Got: ${raw}`,
    );
  }
  return { limit, isDefault: false };
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

/** The longest `Retry-After` the search waits out before it retries. */
const STRATA_MAX_RETRY_AFTER = 2_000;

/** The wait a 429 asks for, in milliseconds, from `Retry-After` in seconds or as a date. */
function retryAfterMs(error: Error): number | undefined {
  const response = "response" in error ? error.response : undefined;
  if (!(response instanceof Response)) {
    return undefined;
  }
  const header = response.headers.get("Retry-After");
  if (header === null) {
    return undefined;
  }
  const seconds = Number(header);
  if (header.trim() !== "" && Number.isFinite(seconds)) {
    return seconds * 1_000;
  }
  const date = Date.parse(header);
  return Number.isNaN(date) ? undefined : date - Date.now();
}

/**
 * Retries for the search request.
 *
 * A 429 from the per-second request limit clears within a second or two, so two
 * short retries absorb it. Strata's own throttling asks for a minute or more,
 * which the client's default (12 retries, each waiting the full `Retry-After`)
 * would turn into a silent wait of 12+ minutes. `maxRetryAfter` only shortens
 * each wait, so retries would still go into a throttle that rejects them: past
 * 2 seconds, `shouldRetry` makes the search fail right away and say why instead.
 */
const STRATA_RETRY = {
  limit: 2,
  methods: ["get"],
  statusCodes: [429],
  maxRetryAfter: STRATA_MAX_RETRY_AFTER,
  backoffLimit: 2_000,
  shouldRetry: ({ error }: { error: Error }): false | undefined => {
    const wait = retryAfterMs(error);
    return wait !== undefined && wait > STRATA_MAX_RETRY_AFTER ? false : undefined;
  },
};

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
  query: StrataSearchQuery;
  ui: UI;
}): Promise<SemanticSearch> {
  const spinner = ui.createSpinner("Searching with Strata...");
  try {
    const { data } = await getMapiClient().strata.search({
      query,
      path: { space_id: Number(spaceId) },
      throwOnError: true,
      fetchOptions: { retry: STRATA_RETRY },
    });
    const hits = data?.results ?? [];

    const ranking = rankHits(hits);
    spinner.succeed(
      `Strata matched ${pluralize(ranking.size, "story", "stories")} (${pluralize(hits.length, "hit", "hits")})`,
    );
    return {
      ranking,
      ...(query.limit !== undefined && hits.length >= query.limit
        ? { fullPageOf: query.limit }
        : {}),
    };
  } catch (error) {
    spinner.failed("Strata search failed");
    throwStrataError(error);
  }
}

/** Printed under the summary when Strata's page came back full. */
export function fullPageMessage(limit: number): string {
  return (
    `Strata returned its maximum of ${limit} hits, and has no next page, so more stories may match. ` +
    "Narrow the search with --starts-with or --container-block, or make the text more specific."
  );
}

const pluralize = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

/** Reads the `code` of Strata's `{ error: { code, message } }` body, if the response carries one. */
function strataErrorCode(data: unknown): string | undefined {
  if (!isRecord(data) || !isRecord(data.error)) {
    return undefined;
  }
  return typeof data.error.code === "string" ? data.error.code : undefined;
}

function strataErrorMessage(data: unknown): string | undefined {
  if (!isRecord(data) || !isRecord(data.error)) {
    return undefined;
  }
  return typeof data.error.message === "string" ? data.error.message : undefined;
}

/** What to tell the user for the Strata error codes they can act on. */
const STRATA_ERROR_HINTS: Record<string, string> = {
  feature_disabled: "Strata is not enabled for this space or its organization (feature_disabled).",
  insufficient_scope:
    "The token is missing the strata:read scope (insufficient_scope). Log in with a token that has it.",
  rate_limited: "Strata is rate limiting searches (rate_limited). Try again in a minute.",
};

/**
 * Turns a failed search into the CLI's errors.
 *
 * A 400 is the query itself: a usage error, like any other rejected flag value.
 * Everything else goes through the usual API error handling, so `--verbose`
 * shows the status and the response body like for any other request. A Strata
 * code the user can act on, e.g. `feature_disabled`, gets its own message,
 * which the bare HTTP status does not tell apart. A 401 keeps the CLI's usual
 * wording.
 */
function throwStrataError(error: unknown): never {
  if (!(error instanceof ClientError) || error.response.status === 0) {
    throw error;
  }
  const { status, data } = error.response;
  const code = strataErrorCode(data);
  const message = strataErrorMessage(data);
  if (status === 400) {
    throw new CommandError(
      `Strata rejected the search${code ? ` (${code})` : ""}${message ? `: ${message}` : "."}`,
    );
  }
  const hint =
    (code && STRATA_ERROR_HINTS[code]) ??
    (status === 429 ? STRATA_ERROR_HINTS.rate_limited : undefined);
  if (hint) {
    // The server's message tells apart causes that share a code, e.g. whether
    // `feature_disabled` is about the space or the organization.
    handleAPIError("search_strata", error, message ? `${hint} Details: ${message}` : hint);
  }
  if (status === 401) {
    handleAPIError("search_strata", error);
  }
  handleAPIError(
    "search_strata",
    error,
    message ? `Strata search failed${code ? ` (${code})` : ""}: ${message}` : undefined,
  );
}
