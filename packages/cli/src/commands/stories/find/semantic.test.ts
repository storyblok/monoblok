import { stripVTControlCharacters } from "node:util";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { vol } from "memfs";
// Import the parent module first so the subcommand registers on it.
import "../index";
import { storiesCommand } from "../command";
import { loadConfigLayers } from "../../../lib/config/helpers";
import { getUI } from "../../../lib/ui";
import { APIError } from "../../../utils/error/api-error";
import { makeMockStory } from "../__tests__/helpers";
import type { MockStory } from "../__tests__/helpers";
import { searchStrata } from "./semantic";

// The config files on disk, as layers: everything else of config resolution is real.
vi.mock("../../../lib/config/helpers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../lib/config/helpers")>()),
  loadConfigLayers: vi.fn(async () => []),
}));

const errorSpy = vi.spyOn(console, "error");
const warnSpy = vi.spyOn(console, "warn");

const STRATA_SEARCH_URL = "https://mapi.storyblok.com/v1/spaces/12345/strata/search";
const MAPI_STORIES_URL = "https://mapi.storyblok.com/v1/spaces/12345/stories";

const server = setupServer();

/** The listing reports `published` as a boolean, which `--publish-status` reads. */
type SpaceStory = Omit<MockStory, "published"> & { published?: MockStory["published"] | boolean };

type Hit = { story: SpaceStory; score: number; excerpt?: string };

/** What each request carried, so a test can assert what was pushed down where. */
type Requests = { strata: URLSearchParams[]; listing: URLSearchParams[] };

const cleanups: (() => void)[] = [];

const preconditions = {
  /**
   * A Strata-enabled space: Strata answers with `hits`, in the order given, and
   * MAPI lists and serves `stories` (the hits plus any others in the space).
   * The listing honours `by_ids`, as the real one does.
   */
  canSearchByMeaning({ hits, stories = [] }: { hits: Hit[]; stories?: SpaceStory[] }): Requests {
    const requests: Requests = { strata: [], listing: [] };
    const all = [...new Set([...hits.map((hit) => hit.story), ...stories])];
    server.use(
      http.get(STRATA_SEARCH_URL, ({ request }) => {
        requests.strata.push(new URL(request.url).searchParams);
        return HttpResponse.json({
          results: hits.map(({ story, score, excerpt }) => ({
            excerpt: excerpt ?? `About ${story.name}`,
            score,
            story: { id: story.id, slug: story.full_slug, name: story.name },
          })),
        });
      }),
      http.get(MAPI_STORIES_URL, ({ request }) => {
        const query = new URL(request.url).searchParams;
        requests.listing.push(query);
        const ids = query.get("by_ids")?.split(",");
        // Listed in id order, the API's own, not Strata's rank.
        const listed = all
          .filter((story) => !ids || ids.includes(String(story.id)))
          .sort((a, b) => Number(a.id) - Number(b.id))
          .map(({ content: _content, ...metadata }) => metadata);
        return HttpResponse.json(
          { stories: listed },
          { headers: { Total: String(listed.length), "Per-Page": "100" } },
        );
      }),
      ...all.map((story) =>
        http.get(`${MAPI_STORIES_URL}/${story.id}`, () => HttpResponse.json({ story })),
      ),
    );
    return requests;
  },
  /** Strata answers every search with this status and error `code`, and counts the attempts. */
  strataRejectsSearches({
    status,
    code,
    message,
  }: {
    status: number;
    code: string;
    message: string;
  }) {
    const attempts = { count: 0 };
    server.use(
      http.get(STRATA_SEARCH_URL, () => {
        attempts.count += 1;
        return HttpResponse.json(
          { error: { message, code, details: null, timestamp: "2026-11-04T00:00:00Z" } },
          { status },
        );
      }),
    );
    return attempts;
  },
  stdoutIsATerminal({ columns = 200 }: { columns?: number } = {}) {
    vi.stubEnv("TERM", "dumb");
    for (const [property, value] of [
      ["isTTY", true],
      ["columns", columns],
    ] as const) {
      const original = Object.getOwnPropertyDescriptor(process.stdout, property);
      Object.defineProperty(process.stdout, property, { value, configurable: true });
      cleanups.push(() => {
        if (original) {
          Object.defineProperty(process.stdout, property, original);
        } else {
          Reflect.deleteProperty(process.stdout, property);
        }
      });
    }
  },
  capturesStdout() {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      written.push(String(chunk));
      return true;
    });
    return written;
  },
  /** A `storyblok.config` file that sets these `stories find` options. */
  configFileSets(options: Record<string, unknown>) {
    vi.mocked(loadConfigLayers).mockResolvedValue([{ modules: { stories: { find: options } } }]);
  },
  countsRequests() {
    const counter = { requests: 0 };
    const count = (): void => {
      counter.requests += 1;
    };
    server.events.on("request:start", count);
    cleanups.push(() => server.events.removeListener("request:start", count));
    return counter;
  },
};

const findCommand = () => {
  const command = storiesCommand.commands.find((candidate) => candidate.name() === "find");
  if (!command) {
    throw new Error("stories find is not registered");
  }
  return command;
};

const find = (...args: string[]) =>
  storiesCommand.parseAsync(["node", "test", "find", "--space", "12345", ...args]);

const parseLines = (written: string[]) =>
  written
    .join("")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

describe("stories find --mode semantic", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => {
    process.exitCode = undefined;
  });
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
    vi.resetAllMocks();
    vi.unstubAllEnvs();
    vol.reset();
    server.resetHandlers();
    // Commander keeps parsed values on the command between runs.
    const command = findCommand();
    for (const option of command.options) {
      command.setOptionValue(option.attributeName(), option.defaultValue);
    }
    process.exitCode = undefined;
  });
  afterAll(() => server.close());

  it("should emit the matching stories in Strata's relevance order, with score and excerpt", async () => {
    const [low, high] = [makeMockStory({ name: "Low" }), makeMockStory({ name: "High" })];
    const requests = preconditions.canSearchByMeaning({
      hits: [
        { story: high, score: 0.9, excerpt: "Plans and prices" },
        { story: low, score: 0.4, excerpt: "A footnote on cost" },
      ],
      stories: [makeMockStory({ name: "Unrelated" })],
    });
    const written = preconditions.capturesStdout();

    await find("pages about pricing", "--mode", "semantic");

    const emitted = parseLines(written);
    expect(emitted.map((story) => story.id)).toEqual([high.id, low.id]);
    expect(emitted[0]).toMatchObject({ _score: 0.9, _excerpt: "Plans and prices" });
    expect(emitted[0].content).toEqual(high.content);
    expect(process.exitCode).toBeFalsy();

    const [strata] = requests.strata;
    expect(strata.get("q")).toBe("pages about pricing");
    expect(strata.get("version")).toBe("draft");
    const [listing] = requests.listing;
    expect(listing.get("by_ids")).toBe(`${high.id},${low.id}`);
    // The text is Strata's to match, not the full-text search's.
    expect(listing.has("text_search")).toBe(false);
  });

  it("should emit a story Strata matched more than once only once, at its best rank", async () => {
    const [story, other] = [makeMockStory(), makeMockStory()];
    preconditions.canSearchByMeaning({
      hits: [
        { story, score: 0.9, excerpt: "best" },
        { story: other, score: 0.7 },
        { story, score: 0.5, excerpt: "weaker" },
      ],
    });
    const written = preconditions.capturesStdout();

    await find("pricing", "--mode", "semantic");

    const emitted = parseLines(written);
    expect(emitted.map((entry) => entry.id)).toEqual([story.id, other.id]);
    expect(emitted[0]._excerpt).toBe("best");
  });

  it("should push --starts-with and --container-block down to Strata, at its scoped page size", async () => {
    const story = makeMockStory();
    const requests = preconditions.canSearchByMeaning({ hits: [{ story, score: 0.8 }] });
    preconditions.capturesStdout();

    await find(
      "pricing",
      "--mode",
      "semantic",
      "--starts-with",
      "docs/",
      "--container-block",
      "article",
    );

    const [strata] = requests.strata;
    expect(strata.get("starts_with")).toBe("docs/");
    expect(strata.get("content_type")).toBe("article");
    expect(strata.get("limit")).toBe("50");
    // Already applied by Strata, so the listing of its matches does not repeat them.
    const [listing] = requests.listing;
    expect(listing.has("starts_with")).toBe(false);
    expect([...listing.keys()].some((key) => key.startsWith("filter_query"))).toBe(false);
  });

  it("should ask Strata for its largest page when unscoped", async () => {
    const requests = preconditions.canSearchByMeaning({
      hits: [{ story: makeMockStory(), score: 0.8 }],
    });
    preconditions.capturesStdout();

    await find("pricing", "--mode", "semantic", "--limit", "1");

    expect(requests.strata[0].get("limit")).toBe("100");
  });

  // Strata's `limit` counts hits, and one story can be several of them.
  it("should limit the number of results, not Strata hits", async () => {
    const [first, second, third] = [makeMockStory(), makeMockStory(), makeMockStory()];
    preconditions.canSearchByMeaning({
      hits: [
        { story: first, score: 0.9 },
        { story: first, score: 0.8 },
        { story: first, score: 0.7 },
        { story: third, score: 0.6 },
        { story: second, score: 0.5 },
      ],
    });
    const written = preconditions.capturesStdout();

    await find("pricing", "--mode", "semantic", "--limit", "2");

    expect(parseLines(written).map((story) => story.id)).toEqual([first.id, third.id]);
    expect(process.exitCode).toBeFalsy();
  });

  it("should keep the best matches when --limit applies after the filters", async () => {
    const withStatus = (name: string, published: boolean): SpaceStory => ({
      ...makeMockStory({ name }),
      published,
    });
    const [best, dropped, next, last] = [
      withStatus("best", false),
      withStatus("live", true),
      withStatus("next", false),
      withStatus("last", false),
    ];
    preconditions.canSearchByMeaning({
      hits: [
        { story: best, score: 0.9 },
        { story: dropped, score: 0.8 },
        { story: next, score: 0.7 },
        { story: last, score: 0.6 },
      ],
    });
    const written = preconditions.capturesStdout();

    await find("pricing", "--mode", "semantic", "--publish-status", "draft", "--limit", "2");

    expect(parseLines(written).map((story) => story.id)).toEqual([best.id, next.id]);
  });

  it("should let --where read the Strata score", async () => {
    const [strong, weak] = [makeMockStory(), makeMockStory()];
    preconditions.canSearchByMeaning({
      hits: [
        { story: strong, score: 1.5 },
        { story: weak, score: 0.2 },
      ],
    });
    const written = preconditions.capturesStdout();

    await find("pricing", "--mode", "semantic", "--where", "$[?($._score > 1)]");

    expect(parseLines(written).map((story) => story.id)).toEqual([strong.id]);
  });

  it("should apply the remaining filters to the hydrated stories", async () => {
    const hero = makeMockStory({ content: { _uid: "a", component: "hero" } });
    const page = makeMockStory({ content: { _uid: "b", component: "page" } });
    preconditions.canSearchByMeaning({
      hits: [
        { story: page, score: 0.9 },
        { story: hero, score: 0.8 },
      ],
    });
    const written = preconditions.capturesStdout();

    await find("pricing", "--mode", "semantic", "--where", '$.content[?(@ == "hero")]');

    expect(parseLines(written).map((story) => story.id)).toEqual([hero.id]);
  });

  // Published-only stories have the same draft and published content, so the
  // published search finds the same matches, with no slots spent on drafts.
  it.each([
    { statuses: "published", version: "published" },
    { statuses: "published,published", version: "published" },
    // Their draft differs from what is live, and the draft is what is printed.
    { statuses: "published-with-changes", version: "draft" },
    { statuses: "published,published-with-changes", version: "draft" },
    { statuses: "draft", version: "draft" },
  ])(
    "should search the $version version with --publish-status $statuses",
    async ({ statuses, version }) => {
      const requests = preconditions.canSearchByMeaning({
        hits: [{ story: makeMockStory(), score: 0.8 }],
      });
      preconditions.capturesStdout();

      await find("pricing", "--mode", "semantic", "--publish-status", statuses);

      expect(requests.strata[0].get("version")).toBe(version);
    },
  );

  it("should list nothing when Strata finds no match", async () => {
    const requests = preconditions.canSearchByMeaning({ hits: [], stories: [makeMockStory()] });
    const written = preconditions.capturesStdout();

    await find("pricing", "--mode", "semantic");

    expect(written).toEqual([]);
    expect(requests.listing).toHaveLength(0);
    expect(process.exitCode).toBeFalsy();
  });

  it("should emit ranked metadata without fetching any story with --skip-content", async () => {
    const [low, high] = [makeMockStory({ name: "Low" }), makeMockStory({ name: "High" })];
    preconditions.canSearchByMeaning({
      hits: [
        { story: high, score: 0.9 },
        { story: low, score: 0.4 },
      ],
    });
    const counter = preconditions.countsRequests();
    const written = preconditions.capturesStdout();

    await find("pricing", "--mode", "semantic", "--skip-content");

    const emitted = parseLines(written);
    expect(emitted.map((story) => story.id)).toEqual([high.id, low.id]);
    expect(emitted[0]).toMatchObject({ _score: 0.9 });
    expect(emitted[0]).not.toHaveProperty("content");
    // The Strata search and one listing, no per-story fetch.
    expect(counter.requests).toBe(2);
    expect(process.exitCode).toBeFalsy();
  });

  it("should show score and excerpt columns in a terminal", async () => {
    const story = makeMockStory({ name: "Pricing" });
    preconditions.canSearchByMeaning({
      hits: [{ story, score: 0.91234, excerpt: "Plans and prices" }],
    });
    preconditions.stdoutIsATerminal();
    const written = preconditions.capturesStdout();

    await find("pricing", "--mode", "semantic");

    const table = stripVTControlCharacters(written.join(""));
    expect(table).toMatch(/SCORE\s+EXCERPT/);
    expect(table).toContain("0.91");
    expect(table).toContain("Plans and prices");
  });

  it("should keep the name readable and shorten the excerpt in a narrow terminal", async () => {
    const story = makeMockStory({ name: "Design Tips for Small Spaces" });
    preconditions.canSearchByMeaning({
      hits: [{ story, score: 0.8, excerpt: "word ".repeat(400) }],
    });
    preconditions.stdoutIsATerminal({ columns: 80 });
    const written = preconditions.capturesStdout();

    await find("design", "--mode", "semantic");

    const table = stripVTControlCharacters(written.join(""));
    expect(table).toContain("Design Tips for Small Spaces");
    for (const line of table.split("\n")) {
      expect(line.length).toBeLessThanOrEqual(80);
    }
  });

  it("should warn that more stories may match when Strata's page comes back full", async () => {
    // 100 hits on 60 stories: a story can be several hits, so a full page
    // prints fewer stories than --limit asks for.
    const stories = Array.from({ length: 60 }, () => makeMockStory());
    const hits = Array.from({ length: 100 }, (_, index) => ({
      story: stories[index % stories.length],
      score: 0.5,
    }));
    preconditions.canSearchByMeaning({ hits });
    preconditions.capturesStdout();

    await find("pricing", "--mode", "semantic", "--skip-content", "--limit", "100");

    expect(warnSpy.mock.calls.flat().join("\n")).toContain(
      "Strata returned its maximum of 100 hits",
    );
  });

  it("should stop at 25 results by default, and say how to get more", async () => {
    const stories = Array.from({ length: 60 }, () => makeMockStory());
    preconditions.canSearchByMeaning({ hits: stories.map((story) => ({ story, score: 0.5 })) });
    const written = preconditions.capturesStdout();

    await find("pricing", "--mode", "semantic", "--skip-content");

    expect(parseLines(written)).toHaveLength(25);
    expect(process.exitCode).toBeFalsy();
    expect(errorSpy.mock.calls.flat().join("\n")).toContain(
      "Stopped at 25 results, the default. Set --limit for more.",
    );
  });

  it("should print up to Strata's page with --limit 100", async () => {
    const stories = Array.from({ length: 60 }, () => makeMockStory());
    preconditions.canSearchByMeaning({ hits: stories.map((story) => ({ story, score: 0.5 })) });
    const written = preconditions.capturesStdout();

    await find("pricing", "--mode", "semantic", "--skip-content", "--limit", "100");

    expect(parseLines(written)).toHaveLength(60);
  });

  it("should not warn about a full page when there is room left on it", async () => {
    preconditions.canSearchByMeaning({ hits: [{ story: makeMockStory(), score: 0.5 }] });
    preconditions.capturesStdout();

    await find("pricing", "--mode", "semantic");

    expect(warnSpy.mock.calls.flat().join("\n")).not.toContain("Strata returned its maximum");
  });

  it.each([
    {
      status: 403,
      code: "feature_disabled",
      expected: "Strata is not enabled for this space or its organization (feature_disabled).",
    },
    {
      status: 403,
      code: "insufficient_scope",
      expected: "The token is missing the strata:read scope (insufficient_scope).",
    },
    {
      status: 401,
      code: "unauthorized",
      expected: "The user is not authorized to access the API",
    },
    {
      status: 503,
      code: "error",
      expected: "Strata search failed (error): search backend unavailable",
    },
  ])("should explain a $status $code from Strata", async ({ status, code, expected }) => {
    preconditions.strataRejectsSearches({ status, code, message: "search backend unavailable" });
    preconditions.capturesStdout();

    await find("pricing", "--mode", "semantic");

    expect(process.exitCode).toBe(1);
    expect(errorSpy.mock.calls.flat().join("\n")).toContain(expected);
  });

  // What `--verbose` prints: the status and the response body.
  it("should keep the status and response body on a failed search", async () => {
    preconditions.strataRejectsSearches({
      status: 403,
      code: "feature_disabled",
      message: "Strata is disabled for this space",
    });

    const search = searchStrata({ spaceId: "12345", query: { q: "pricing" }, ui: getUI() });

    await expect(search).rejects.toBeInstanceOf(APIError);
    await expect(search.catch((error: APIError) => error.getInfo())).resolves.toMatchObject({
      httpCode: 403,
      responseData: { error: { code: "feature_disabled" } },
    });
  });

  // Strata's own throttling asks for a minute or more: retrying through it
  // would leave the user staring at a spinner.
  it("should give up on a rate-limited search after two short retries", async () => {
    const attempts = preconditions.strataRejectsSearches({
      status: 429,
      code: "rate_limited",
      message: "slow down",
    });
    preconditions.capturesStdout();

    await find("pricing", "--mode", "semantic");

    expect(attempts.count).toBe(3);
    expect(process.exitCode).toBe(1);
    expect(errorSpy.mock.calls.flat().join("\n")).toContain(
      "Strata is rate limiting searches (rate_limited). Try again in a minute.",
    );
  });

  it("should treat a search Strata rejects as invalid as a usage error", async () => {
    preconditions.strataRejectsSearches({
      status: 400,
      code: "invalid_argument",
      message: "q is too long",
    });
    preconditions.capturesStdout();

    await find("pricing", "--mode", "semantic");

    expect(process.exitCode).toBe(2);
    expect(errorSpy.mock.calls.flat().join("\n")).toContain(
      "Strata rejected the search (invalid_argument): q is too long",
    );
  });

  it.each([
    { args: [], message: "--mode semantic needs a search text" },
    { args: ["pricing", "--limit", "0"], message: "--limit expects a whole number of 1 or more" },
    {
      args: ["pricing", "--container-block", "page,article"],
      message: "a single --container-block",
    },
    { args: ["pricing", "--container-block", ","], message: "--container-block expects a value" },
    { args: ["pricing", "--starts-with", "/"], message: "--starts-with expects a slug prefix" },
    {
      args: ["pricing", "--limit", "101"],
      message: "--limit is at most 100 with --mode semantic: Strata returns at most 100 matches",
    },
    {
      args: ["pricing", "--starts-with", "docs", "--limit", "51"],
      message: "--limit is at most 50 with --mode semantic with --starts-with or --container-block",
    },
  ])("should reject $args before any request", async ({ args, message }) => {
    const counter = preconditions.countsRequests();

    await find(...args, "--mode", "semantic");

    expect(process.exitCode).toBe(2);
    expect(errorSpy.mock.calls.flat().join("\n")).toContain(message);
    expect(counter.requests).toBe(0);
  });

  it.each([
    { args: ["--sort", "name:asc"], flag: "--sort" },
    { args: ["--check-references"], flag: "--check-references" },
    { args: ["--capi-filter", "--where", "$.content"], flag: "--capi-filter" },
    { args: ["--entry-type", "folder"], flag: "--entry-type folder" },
    { args: ["--capi-params", "version=published"], flag: "--capi-params" },
  ])("should reject $flag as incompatible, and list every such flag", async ({ args, flag }) => {
    const counter = preconditions.countsRequests();

    await find("pricing", "--mode", "semantic", ...args);

    const stderr = stripVTControlCharacters(errorSpy.mock.calls.flat().join("\n"));
    expect(process.exitCode).toBe(2);
    expect(stderr).toContain(`${flag} is not compatible with --mode semantic`);
    expect(stderr).toContain(
      "Not available with --mode semantic: --entry-type folder, --sort, --check-references, --capi-filter, --capi-params.",
    );
    expect(counter.requests).toBe(0);
  });

  // Strata only returns stories, so asking for stories only asks for what it does.
  it("should accept --entry-type story", async () => {
    preconditions.canSearchByMeaning({ hits: [{ story: makeMockStory(), score: 0.8 }] });
    preconditions.capturesStdout();

    await find("pricing", "--mode", "semantic", "--entry-type", "story");

    expect(process.exitCode).toBeFalsy();
  });

  // A config file sets defaults for full-text runs, and nothing on the command
  // line could clear a sort it sets: there is no `--no-sort`.
  it("should leave out an incompatible flag set in the config file", async () => {
    const requests = preconditions.canSearchByMeaning({
      hits: [{ story: makeMockStory(), score: 0.8 }],
    });
    const written = preconditions.capturesStdout();
    preconditions.configFileSets({ sort: "name:asc", entryType: "folder" });

    await find("pricing", "--mode", "semantic");

    expect(process.exitCode).toBeFalsy();
    expect(parseLines(written)).toHaveLength(1);
    expect(requests.listing[0].has("sort_by")).toBe(false);
    expect(requests.listing[0].has("folder_only")).toBe(false);
  });

  it.each([
    { checkReferences: false },
    { capiFilter: false },
    { capiParams: "" },
    { entryType: "all" },
  ])("should accept a config file that switches an incompatible flag off: %o", async (config) => {
    preconditions.canSearchByMeaning({ hits: [{ story: makeMockStory(), score: 0.8 }] });
    preconditions.capturesStdout();
    preconditions.configFileSets(config);

    await find("pricing", "--mode", "semantic");

    expect(process.exitCode).toBeFalsy();
  });

  it("should name every incompatible flag at once", async () => {
    await find("pricing", "--mode", "semantic", "--sort", "name:asc", "--capi-filter");

    const stderr = errorSpy.mock.calls.flat().join("\n");
    expect(stderr).toContain("--sort is not compatible");
    expect(stderr).toContain("--capi-filter is not compatible");
  });
});
