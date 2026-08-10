import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { vol } from "memfs";

import "../index";
import { storiesCommand } from "../command";
import { resetReporter } from "../../../lib/reporter/reporter";
import { getUI } from "../../../lib/ui";
import { session } from "../../../session";
import { loggedOutSessionState } from "../../../../test/setup";
import { makeMockStory } from "../__tests__/helpers";
import type { MockStory } from "../__tests__/helpers";

// Mock jiti so the loader classifies a controlled schema module.
let schemaModule: Record<string, unknown> = {};
vi.mock("jiti", () => ({
  createJiti: () => ({
    import: async () => schemaModule,
  }),
}));

vi.spyOn(console, "error");
vi.spyOn(console, "warn");
vi.spyOn(process.stdout, "write").mockReturnValue(true);

const server = setupServer();

const preconditions = {
  canListStories(stories: MockStory[], params: Record<string, string> = {}) {
    server.use(
      http.get("https://mapi.storyblok.com/v1/spaces/12345/stories", ({ request }) => {
        const url = new URL(request.url);
        const matches = Object.entries(params).every(
          ([key, value]) => url.searchParams.get(key) === value,
        );
        const page = Number(url.searchParams.get("page") ?? 1);
        return HttpResponse.json(
          { stories: matches && page === 1 ? stories : [] },
          { headers: { Total: String(stories.length), "Per-Page": "100" } },
        );
      }),
    );
  },
  canFetchStories(stories: MockStory[]) {
    for (const story of stories) {
      server.use(
        http.get(`https://mapi.storyblok.com/v1/spaces/12345/stories/${story.id}`, () =>
          HttpResponse.json({ story }),
        ),
      );
    }
  },
  listEndpointFails() {
    server.use(
      http.get("https://mapi.storyblok.com/v1/spaces/12345/stories", () =>
        HttpResponse.json({ message: "Internal Server Error" }, { status: 500 }),
      ),
    );
  },
  storyFetchFails(id: MockStory["id"]) {
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/12345/stories/${id}`, () =>
        HttpResponse.json({ message: "Internal Server Error" }, { status: 500 }),
      ),
    );
  },
};

/** Everything the UI printed for humans (all UI output routes to stderr). */
function loggedOutput(): string {
  const spied = (method: typeof console.error) =>
    (method as unknown as { mock: { calls: unknown[][] } }).mock.calls;
  return [...spied(console.error), ...spied(console.warn)]
    .map((call) => String(call[0]))
    .join("\n");
}

/** Everything written to stdout via `UI.writeMachineOutput()` (i.e. `--format json`). */
function machineOutput(): string {
  return (process.stdout.write as unknown as { mock: { calls: unknown[][] } }).mock.calls
    .map((call) => String(call[0]))
    .join("");
}

async function runValidate(...args: string[]): Promise<void> {
  await storiesCommand.parseAsync([
    "node",
    "test",
    "validate",
    "--space",
    "12345",
    "--schema",
    "src/schema.ts",
    ...args,
  ]);
}

describe("stories validate command", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => {
    // A `page` block with a required `headline` text field.
    schemaModule = {
      page: { name: "page", fields: [{ name: "headline", type: "text", required: true }] },
    };
    // The loader checks the entry file exists before handing it to jiti, so it
    // has to be present in the mocked filesystem even though jiti is stubbed.
    vol.fromJSON({ "src/schema.ts": "export const page = {};" });
  });
  afterEach(() => {
    vi.clearAllMocks();
    vol.reset();
    server.resetHandlers();
    resetReporter();
    process.exitCode = undefined;
  });
  afterAll(() => server.close());

  it("should exit 0 when every story matches the schema", async () => {
    const stories = [
      makeMockStory({ full_slug: "home", content: { component: "page", headline: "Hi" } }),
      makeMockStory({ full_slug: "about", content: { component: "page", headline: "About" } }),
    ];
    preconditions.canListStories(stories);
    preconditions.canFetchStories(stories);

    await runValidate();

    expect(process.exitCode).toBe(0);
    expect(loggedOutput()).toContain("0 errors, 0 warnings across 0 of 2 stories");
  });

  it("should exit 1 and report missing required (error) and unknown field (warning)", async () => {
    const story = makeMockStory({
      id: 123456,
      full_slug: "app/home",
      content: { component: "page", legacy_cta: "x" },
    });
    preconditions.canListStories([story]);
    preconditions.canFetchStories([story]);

    await runValidate();

    expect(process.exitCode).toBe(1);
    const output = loggedOutput();
    expect(output).toContain("app/home (story #123456)");
    expect(output).toContain("missing_required_field");
    expect(output).toContain("unknown_field");
    expect(output).toContain("1 error, 1 warning across 1 of 1 story");
  });

  it("should skip folders and exclude them from the total", async () => {
    const folder = makeMockStory({ full_slug: "blog", is_folder: true });
    const story = makeMockStory({
      full_slug: "home",
      content: { component: "page", headline: "Hi" },
    });
    preconditions.canListStories([folder, story]);
    // Only the non-folder story is registered for fetch; if the folder were
    // fetched, msw's onUnhandledRequest:'error' would fail the test.
    preconditions.canFetchStories([story]);

    await runValidate();

    expect(process.exitCode).toBe(0);
    expect(loggedOutput()).toContain("across 0 of 1 story");
  });

  it("should exit 1 and count per-story fetch failures", async () => {
    const story = makeMockStory({
      id: 999,
      full_slug: "broken",
      content: { component: "page", headline: "Hi" },
    });
    preconditions.canListStories([story]);
    preconditions.storyFetchFails(story.id);

    await runValidate();

    expect(process.exitCode).toBe(1);
  });

  // A listing failure is an API failure, not a bad invocation, so it exits 1 like
  // every other runtime error: `handleError` owns the mapping.
  it("should exit 1 when the list endpoint is down", async () => {
    preconditions.listEndpointFails();

    await runValidate();

    expect(process.exitCode).toBe(1);
  });

  // A failed listing used to fall through to the formatter, ending a failed run
  // with a green "0 errors, 0 warnings" line.
  it("should not print a clean summary when the listing failed", async () => {
    preconditions.listEndpointFails();

    await runValidate();

    expect(process.exitCode).toBe(1);
    expect(loggedOutput()).not.toContain("0 errors, 0 warnings");
  });

  it("should report ok:false in JSON when the listing failed", async () => {
    preconditions.listEndpointFails();

    await runValidate("--format", "json");

    expect(process.exitCode).toBe(1);
    expect(JSON.parse(machineOutput())).toMatchObject({ ok: false, listFailed: true });
  });

  // Regression: handleError's "run with --verbose" hint used to go to stdout,
  // which made the JSON document unparseable on any run that also reported an error.
  it("should keep the verbose hint off stdout when emitting JSON", async () => {
    preconditions.listEndpointFails();

    await runValidate("--format", "json");

    expect(() => JSON.parse(machineOutput())).not.toThrow();
    expect(machineOutput()).not.toContain("--verbose");
  });

  it("should still print the verbose hint for pretty output", async () => {
    preconditions.listEndpointFails();

    await runValidate();

    expect(loggedOutput()).toContain("--verbose");
  });

  it("should report ok:false in JSON when a story could not be fetched", async () => {
    const story = makeMockStory({
      id: 999,
      full_slug: "broken",
      content: { component: "page", headline: "Hi" },
    });
    preconditions.canListStories([story]);
    preconditions.storyFetchFails(story.id);

    await runValidate("--format", "json");

    expect(process.exitCode).toBe(1);
    expect(JSON.parse(machineOutput())).toMatchObject({ ok: false, fetchFailures: 1, errors: 0 });
  });

  it("should emit pure, parseable JSON for --format json", async () => {
    const story = makeMockStory({
      id: 123456,
      full_slug: "app/home",
      content: { component: "page", legacy_cta: "x" },
    });
    preconditions.canListStories([story]);
    preconditions.canFetchStories([story]);

    await runValidate("--format", "json");

    expect(process.exitCode).toBe(1);
    const report = JSON.parse(machineOutput());
    expect(report).toMatchObject({
      ok: false,
      unit: "stories",
      errors: 1,
      warnings: 1,
      unitsTotal: 1,
    });
    expect(report.groups[0].header).toBe("app/home (story #123456)");
    // Nothing decorative may land on stdout alongside the document.
    expect(machineOutput().trimEnd()).toBe(JSON.stringify(report, null, 2));
  });

  it("should report ok:true in JSON for a clean run", async () => {
    const story = makeMockStory({
      full_slug: "home",
      content: { component: "page", headline: "Hi" },
    });
    preconditions.canListStories([story]);
    preconditions.canFetchStories([story]);

    await runValidate("--format", "json");

    expect(process.exitCode).toBe(0);
    expect(JSON.parse(machineOutput())).toMatchObject({
      ok: true,
      errors: 0,
      fetchFailures: 0,
      listFailed: false,
    });
  });

  it("should exit 2 for an invalid --format value", async () => {
    await runValidate("--format", "yaml");

    expect(process.exitCode).toBe(2);
  });

  it("should exit 2 when --schema is omitted", async () => {
    await storiesCommand.parseAsync(["node", "test", "validate", "--space", "12345"]);

    expect(process.exitCode).toBe(2);
  });

  it("should exit 2 when the schema entry exports no definitions", async () => {
    schemaModule = { helper: () => {} };
    const story = makeMockStory({ content: { component: "page" } });
    preconditions.canListStories([story]);
    preconditions.canFetchStories([story]);

    await runValidate();

    expect(process.exitCode).toBe(2);
  });

  // Without blocks, every story would report `unknown_component` — a wall of
  // issues pointing at the content instead of at the schema entry file.
  it("should exit 2 when the schema entry defines datasources but no blocks", async () => {
    schemaModule = { colors: { name: "Colors", slug: "colors" } };

    await runValidate();

    expect(process.exitCode).toBe(2);
    expect(loggedOutput()).toContain("No blocks found in the schema entry file");
  });

  it("should scope validation with --starts-with", async () => {
    const story = makeMockStory({
      full_slug: "en/home",
      content: { component: "page", headline: "Hi" },
    });
    preconditions.canListStories([story], { starts_with: "en/" });
    preconditions.canFetchStories([story]);

    await runValidate("--starts-with", "en/");

    expect(process.exitCode).toBe(0);
    expect(loggedOutput()).toContain("across 0 of 1 story");
  });

  // Regression: a `full_slug` never starts with a slash and MAPI matches the
  // prefix literally, so the documented `--starts-with="/en/blog/"` form
  // selected nothing and reported a green run over 0 stories.
  it("should strip a leading slash from --starts-with", async () => {
    const story = makeMockStory({
      full_slug: "en/home",
      content: { component: "page", headline: "Hi" },
    });
    // The handler only answers when `starts_with` is exactly `en/`.
    preconditions.canListStories([story], { starts_with: "en/" });
    preconditions.canFetchStories([story]);

    await runValidate("--starts-with", "/en/");

    expect(process.exitCode).toBe(0);
    expect(loggedOutput()).toContain("across 0 of 1 story");
  });

  it("should warn when --starts-with matched no stories", async () => {
    preconditions.canListStories([]);

    await runValidate("--starts-with", "nope/");

    expect(process.exitCode).toBe(0);
    expect(loggedOutput()).toContain('No stories matched --starts-with "nope/"');
  });

  // The bar is created lazily so a run with nothing to count leaves no bar
  // behind. A zero-match filter used to draw `0% | 0/1 processed` above the
  // warning saying nothing was validated.
  it("should create no progress bar when there is nothing to count", async () => {
    const createProgressBar = vi.spyOn(getUI(), "createProgressBar");
    preconditions.canListStories([]);

    await runValidate("--starts-with", "nope/");

    expect(createProgressBar).not.toHaveBeenCalled();
  });

  it("should create a progress bar once there are stories to count", async () => {
    const createProgressBar = vi.spyOn(getUI(), "createProgressBar");
    const stories = [makeMockStory({ content: { component: "page", headline: "Hi" } })];
    preconditions.canListStories(stories);
    preconditions.canFetchStories(stories);

    await runValidate();

    expect(createProgressBar).toHaveBeenCalled();
  });

  it("should not warn about an empty space when no filter was given", async () => {
    preconditions.canListStories([]);

    await runValidate();

    expect(loggedOutput()).not.toContain("No stories matched");
  });

  // The pretty run warns; a `--format json` consumer sees no stderr, so without
  // this the document is indistinguishable from a clean run over real content.
  it("should surface a filter that matched no stories in the JSON document", async () => {
    preconditions.canListStories([]);

    await runValidate("--starts-with", "nope/", "--format", "json");

    expect(JSON.parse(machineOutput())).toMatchObject({
      ok: true,
      unitsTotal: 0,
      noMatches: true,
      filter: { option: "--starts-with", value: "nope/" },
    });
  });

  it("should echo the normalized filter, not the raw argument", async () => {
    const story = makeMockStory({
      full_slug: "en/home",
      content: { component: "page", headline: "Hi" },
    });
    preconditions.canListStories([story], { starts_with: "en/" });
    preconditions.canFetchStories([story]);

    await runValidate("--starts-with", "/en/", "--format", "json");

    const report = JSON.parse(machineOutput());
    expect(report.filter).toEqual({ option: "--starts-with", value: "en/" });
    expect(report).not.toHaveProperty("noMatches");
  });

  // Stories are fetched concurrently, so arrival order varies between runs;
  // unsorted output is not diffable in CI.
  it("should order groups by path, not by arrival", async () => {
    const stories = [
      makeMockStory({ id: 2, full_slug: "zebra", content: { component: "page" } }),
      makeMockStory({ id: 1, full_slug: "alpha", content: { component: "page" } }),
    ];
    preconditions.canListStories(stories);
    preconditions.canFetchStories(stories);

    await runValidate("--format", "json");

    const report = JSON.parse(machineOutput());
    expect(report.groups.map((group: { ref: { slug: string } }) => group.ref.slug)).toEqual([
      "alpha",
      "zebra",
    ]);
  });

  // Regression: ordering with `localeCompare` depends on the runtime's default
  // locale and ICU build. `älpha` sorts before `zebra` under `en`/`de` but after
  // it under `sv`, so two CI runners with a different `LANG` produced different
  // output for identical content — the opposite of the diffable ordering the sort
  // exists for. Plain string comparison is locale-independent, which puts the
  // non-ASCII slug last here.
  it("should order groups independently of the runtime locale", async () => {
    const stories = [
      makeMockStory({ id: 1, full_slug: "älpha", content: { component: "page" } }),
      makeMockStory({ id: 2, full_slug: "zebra", content: { component: "page" } }),
    ];
    preconditions.canListStories(stories);
    preconditions.canFetchStories(stories);

    await runValidate("--format", "json");

    const slugs = JSON.parse(machineOutput()).groups.map(
      (group: { ref: { slug: string } }) => group.ref.slug,
    );
    expect(slugs).toEqual(["zebra", "älpha"]);
  });

  it("should carry each story's identity in the JSON groups", async () => {
    const story = makeMockStory({
      id: 123456,
      name: "Home",
      full_slug: "app/home",
      content: { component: "page" },
    });
    preconditions.canListStories([story]);
    preconditions.canFetchStories([story]);

    await runValidate("--format", "json");

    expect(JSON.parse(machineOutput()).groups[0].ref).toEqual({
      kind: "story",
      id: 123456,
      slug: "app/home",
      name: "Home",
    });
  });

  it("should carry the reason a failed listing aborted the run in JSON", async () => {
    preconditions.listEndpointFails();

    await runValidate("--format", "json");

    expect(JSON.parse(machineOutput()).listError).toBeTruthy();
  });

  it("should carry the reason a story could not be fetched in JSON", async () => {
    const story = makeMockStory({
      id: 999,
      full_slug: "broken",
      content: { component: "page", headline: "Hi" },
    });
    preconditions.canListStories([story]);
    preconditions.storyFetchFails(story.id);

    await runValidate("--format", "json");

    const [failure] = JSON.parse(machineOutput()).fetchErrors;
    expect(failure).toMatchObject({ id: 999, slug: "broken" });
    expect(failure.message).toBeTruthy();
  });

  it("should exit 2 when not logged in", async () => {
    // `preAction` calls `initializeSession`; make that one call land logged out.
    vi.mocked(session().initializeSession).mockImplementationOnce(async () => {
      session().state = loggedOutSessionState();
    });

    await runValidate();

    expect(process.exitCode).toBe(2);
  });
});
