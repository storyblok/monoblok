import type { Command } from "commander";
import { ClientError, createApiClient } from "@storyblok/api-client";
import type { StrataSearchHit } from "@storyblok/api-client";
import type { RegionCode } from "../../../constants";
import type { TableColumn, UI } from "../../../lib/ui";
import { CommandError } from "../../../utils/error/command-error";
import { redactClientError } from "../../../utils/error/redact";
import { isRecord } from "../../../utils/object";
import { fetchSpace } from "../../spaces/actions";
import type { Story } from "../constants";
import { buildStoryScopeParams } from "../query-params";
import { parseCapiParams } from "./capi";
import { splitList } from "./actions";
import { STORY_COLUMNS } from "./columns";
import type { FindOptions } from "./types";

/** Strata returns a single page of at most this many hits; there is no pagination. */
export const STRATA_MAX_LIMIT = 100;

/** Strata's lower cap once `starts_with` or `content_type` narrows the search. */
export const STRATA_MAX_SCOPED_LIMIT = 50;

/** The only `--capi-params` key semantic mode reads: the rest of the Strata query has its own flags. */
const STRATA_VERSIONS = new Set(["draft", "published"]);

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
 * Reads the content version from `--capi-params`, the flag that already picks it
 * for the other CDN-backed path of the command.
 *
 * Draft is the default for the same reason as there: the stories the command
 * emits carry Management API content, which is the draft.
 */
function parseSemanticVersion(raw: string | undefined): StrataQuery["version"] {
  const params = parseCapiParams(raw);
  const unsupported = Object.keys(params).filter((key) => key !== "version");
  if (unsupported.length > 0) {
    throw new CommandError(
      `--capi-params only sets "version" with --mode semantic, and got: ${unsupported.join(", ")}`,
    );
  }
  const version = params.version ?? "draft";
  if (typeof version !== "string" || !STRATA_VERSIONS.has(version)) {
    throw new CommandError(
      `--capi-params version expects draft or published, and got: ${String(version)}`,
    );
  }
  return version === "published" ? "published" : "draft";
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
    version: parseSemanticVersion(options.capiParams),
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
 * Runs the Strata search with the space's preview token.
 *
 * The preview token is what makes `version=draft` searchable, and resolving it
 * costs the one Management API request a `--capi-filter` run makes up front too.
 */
export async function searchStrata({
  spaceId,
  region,
  query,
  ui,
}: {
  spaceId: string;
  region: RegionCode | undefined;
  query: StrataQuery;
  ui: UI;
}): Promise<SemanticRanking> {
  const spinner = ui.createSpinner("Searching with Strata...");
  try {
    const space = await fetchSpace(spaceId);
    const token = space?.first_token;
    if (!token) {
      throw new CommandError(
        `No Content Delivery API token available for space ${spaceId}. --mode semantic searches through the CDN, which needs the space's preview token.`,
      );
    }

    const client = createApiClient({
      accessToken: token,
      region: region ?? "eu",
      throwOnError: true,
    });
    const { data } = await client.strata.search({ query });

    const ranking = rankHits(data.results);
    spinner.succeed(
      `Strata matched ${pluralize(ranking.size, "story", "stories")} (${pluralize(data.results.length, "hit", "hits")})`,
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
    return redactClientError(error);
  }
  const { status, data } = error.response;
  const reason = describeStrataError(data);
  const message = `Strata search failed (HTTP ${status})${reason ? `: ${reason}` : ""}`;
  // A 400 is the query itself: a usage error, like any other rejected flag value.
  return status === 400 ? new CommandError(message) : new Error(message);
}
