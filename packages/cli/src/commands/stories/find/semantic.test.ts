import { stripVTControlCharacters } from "node:util";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { vol } from "memfs";
// Import the parent module first so the subcommand registers on it.
import "../index";
import { storiesCommand } from "../command";
import { makeMockStory } from "../__tests__/helpers";
import type { MockStory } from "../__tests__/helpers";

const errorSpy = vi.spyOn(console, "error");

const STRATA_SEARCH_URL = "https://api.storyblok.com/v2/cdn/strata/search";
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
      http.get("https://mapi.storyblok.com/v1/spaces/12345", () =>
        HttpResponse.json({ space: { id: 12345, name: "Test", first_token: "preview-token" } }),
      ),
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
  strataIsDisabledForTheSpace() {
    server.use(
      http.get("https://mapi.storyblok.com/v1/spaces/12345", () =>
        HttpResponse.json({ space: { id: 12345, name: "Test", first_token: "preview-token" } }),
      ),
      http.get(STRATA_SEARCH_URL, () =>
        HttpResponse.json(
          {
            error: {
              message: "Strata is disabled for this space",
              code: "feature_disabled",
              details: null,
              timestamp: "2026-11-04T00:00:00Z",
            },
          },
          { status: 403 },
        ),
      ),
    );
  },
  stdoutIsATerminal() {
    vi.stubEnv("TERM", "dumb");
    vi.stubEnv("COLUMNS", "200");
    const original = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
    cleanups.push(() => {
      if (original) {
        Object.defineProperty(process.stdout, "isTTY", original);
      } else {
        delete (process.stdout as { isTTY?: boolean }).isTTY;
      }
    });
  },
  capturesStdout() {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      written.push(String(chunk));
      return true;
    });
    return written;
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
    for (const command of storiesCommand.commands) {
      if (command.name() === "find") {
        for (const option of command.options) {
          command.setOptionValue(option.attributeName(), option.defaultValue);
        }
      }
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
    expect(strata.get("token")).toBe("preview-token");
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

  it("should search published content when --capi-params asks for it", async () => {
    const requests = preconditions.canSearchByMeaning({
      hits: [{ story: makeMockStory(), score: 0.8 }],
    });
    preconditions.capturesStdout();

    await find("pricing", "--mode", "semantic", "--capi-params", "version=published");

    expect(requests.strata[0].get("version")).toBe("published");
  });

  it("should list nothing when Strata finds no match", async () => {
    const requests = preconditions.canSearchByMeaning({ hits: [], stories: [makeMockStory()] });
    const written = preconditions.capturesStdout();

    await find("pricing", "--mode", "semantic");

    expect(written).toEqual([]);
    expect(requests.listing).toHaveLength(0);
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

  it("should report Strata's reason when it rejects the search", async () => {
    preconditions.strataIsDisabledForTheSpace();
    preconditions.capturesStdout();

    await find("pricing", "--mode", "semantic");

    expect(process.exitCode).toBe(1);
    expect(errorSpy.mock.calls.flat().join("\n")).toContain(
      "Strata search failed (HTTP 403): feature_disabled: Strata is disabled for this space",
    );
  });

  it.each([
    { args: [], message: "--mode semantic needs a search text" },
    { args: ["pricing", "--limit", "0"], message: "--limit expects a whole number of 1 or more" },
    {
      args: ["pricing", "--container-block", "page,article"],
      message: "a single --container-block",
    },
    { args: ["pricing", "--capi-params", "language=de"], message: 'only sets "version"' },
    { args: ["pricing", "--capi-params", "version=latest"], message: "draft or published" },
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
    { args: ["--entry-type", "story"], flag: "--entry-type" },
  ])(
    "should reject $flag as incompatible and show the help for this mode",
    async ({ args, flag }) => {
      const counter = preconditions.countsRequests();

      await find("pricing", "--mode", "semantic", ...args);

      const stderr = stripVTControlCharacters(errorSpy.mock.calls.flat().join("\n"));
      expect(process.exitCode).toBe(2);
      expect(stderr).toContain(`${flag} is not compatible with --mode semantic`);
      const help = stderr.slice(stderr.indexOf("Options compatible with --mode semantic"));
      expect(help).toContain("--starts-with");
      expect(help).toContain("--where");
      expect(help).not.toContain(`${flag} `);
      expect(counter.requests).toBe(0);
    },
  );

  it("should name every incompatible flag at once", async () => {
    await find("pricing", "--mode", "semantic", "--sort", "name:asc", "--capi-filter");

    const stderr = errorSpy.mock.calls.flat().join("\n");
    expect(stderr).toContain("--sort is not compatible");
    expect(stderr).toContain("--capi-filter is not compatible");
  });
});
