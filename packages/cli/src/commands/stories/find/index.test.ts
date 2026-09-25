import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { vol } from "memfs";
// Import the parent module first so the subcommand registers on it.
import "../index";
import { storiesCommand } from "../command";
import { makeMockStory } from "../__tests__/helpers";

const errorSpy = vi.spyOn(console, "error");

const server = setupServer();

const preconditions = {
  /**
   * `count` stories over 100-per-page listings, each answering its own content
   * fetch.
   *
   * `slow` puts a delay on every request, which is what makes the listing still
   * be in flight when the reader hangs up: the teardown only reaches a stage
   * that has work outstanding, and a listing that already finished has none.
   * Reproducing the real shape of the run is the whole point — a single instant
   * page hides the bug entirely.
   */
  canFindStories(
    count: number,
    { slow = false, jitter = false }: { slow?: boolean; jitter?: boolean } = {},
  ) {
    const stories = Array.from({ length: count }, () => makeMockStory());
    server.use(
      http.get("https://mapi.storyblok.com/v1/spaces/12345/stories", async ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get("page") ?? 1);
        if (slow) {
          await delay(40);
        }
        return HttpResponse.json(
          { stories: stories.slice((page - 1) * 100, page * 100) },
          { headers: { Total: String(count), "Per-Page": "100" } },
        );
      }),
    );
    for (const story of stories) {
      server.use(
        http.get(`https://mapi.storyblok.com/v1/spaces/12345/stories/${story.id}`, async () => {
          if (slow) {
            await delay(20);
          }
          if (jitter) {
            // Later stories answer first, so completion order is the reverse of listing order.
            await delay((count - stories.indexOf(story)) * 3);
          }
          return HttpResponse.json({ story });
        }),
      );
    }
    return stories;
  },
  /**
   * A space whose `hero` block has a relation field, one story linking to a
   * story that is not there, and one story linking to nothing at all.
   *
   * The listing answers `by_uuids` too, which is how the scan resolves a target
   * outside the searched scope: an unknown uuid has to come back empty, or every
   * broken reference would resolve to whatever the handler felt like returning.
   */
  canCheckReferences({ linkingStories = 1 }: { linkingStories?: number } = {}) {
    const missingUuid = "11111111-2222-3333-4444-555555555555";
    const linkingAll = Array.from({ length: linkingStories }, (_, index) =>
      makeMockStory({
        slug: `linking-${index}`,
        content: {
          _uid: "a",
          component: "hero",
          link: { fieldtype: "multilink", linktype: "story", id: missingUuid, cached_url: "gone" },
        },
      }),
    );
    const [linking] = linkingAll;
    const plain = makeMockStory({ slug: "plain" });
    const stories = [...linkingAll, plain];

    server.use(
      http.get("https://mapi.storyblok.com/v1/spaces/12345/components", () =>
        HttpResponse.json({
          components: [
            { name: "hero", schema: { link: { type: "multilink" } } },
            { name: "page", schema: {} },
          ],
        }),
      ),
      http.get("https://mapi.storyblok.com/v1/spaces/12345/stories", ({ request }) => {
        const byUuids = new URL(request.url).searchParams.get("by_uuids");
        const matching = byUuids
          ? stories.filter((story) => byUuids.split(",").includes(story.uuid))
          : stories;
        return HttpResponse.json(
          { stories: matching },
          { headers: { Total: String(matching.length), "Per-Page": "100" } },
        );
      }),
    );
    for (const story of stories) {
      server.use(
        http.get(`https://mapi.storyblok.com/v1/spaces/12345/stories/${story.id}`, () =>
          HttpResponse.json({ story }),
        ),
      );
    }

    return { linking, plain, missingUuid };
  },
  /**
   * The reader on the other end of stdout exits after `afterLines`.
   *
   * Node surfaces a closed pipe as an asynchronous `'error'` event carrying
   * `EPIPE`, which is the only signal the command ever gets, so that is what is
   * reproduced here rather than a mocked-out abort.
   */
  readerClosesThePipeAfter(afterLines: number) {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      written.push(String(chunk));
      if (written.length === afterLines) {
        process.stdout.emit("error", Object.assign(new Error("write EPIPE"), { code: "EPIPE" }));
      }
      return true;
    });
    return written;
  },
};

describe("stories find command", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  beforeEach(() => {
    process.exitCode = undefined;
  });
  afterEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    vol.reset();
    server.resetHandlers();
    process.exitCode = undefined;
  });
  afterAll(() => server.close());

  it("should emit one JSON document per line on stdout", async () => {
    const stories = preconditions.canFindStories(3);
    const written = preconditions.readerClosesThePipeAfter(Number.POSITIVE_INFINITY);

    await storiesCommand.parseAsync(["node", "test", "find", "--space", "12345"]);

    expect(written).toHaveLength(stories.length);
    for (const line of written) {
      expect(line.endsWith("\n")).toBe(true);
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  // The one mode that cannot stream: an issue is only decidable once the whole
  // scope has been listed, so matches are buffered and then written through the
  // same sink a streaming run uses.
  it("should emit only the stories with reference issues, annotated", async () => {
    const { linking, missingUuid } = preconditions.canCheckReferences();
    const written = preconditions.readerClosesThePipeAfter(Number.POSITIVE_INFINITY);

    await storiesCommand.parseAsync([
      "node",
      "test",
      "find",
      "--space",
      "12345",
      "--check-references",
    ]);

    expect(written).toHaveLength(1);
    const emitted = JSON.parse(written[0]);
    expect(emitted.uuid).toBe(linking.uuid);
    expect(emitted._ref_issues).toEqual([
      {
        type: "broken",
        ref_type: "multilink",
        target_uuid: missingUuid,
        cached_url: "gone",
        field_path: "content.link",
      },
    ]);
  });

  it("should emit stories in listing order however their fetches complete", async () => {
    const stories = preconditions.canFindStories(8, { jitter: true });
    const written = preconditions.readerClosesThePipeAfter(Number.POSITIVE_INFINITY);

    await storiesCommand.parseAsync([
      "node",
      "test",
      "find",
      "--space",
      "12345",
      "--sort",
      "slug:asc",
    ]);

    expect(written.map((line) => JSON.parse(line).id)).toEqual(stories.map((story) => story.id));
  });

  it("should end a limited reference check at exit 0, counting only what was written", async () => {
    preconditions.canCheckReferences({ linkingStories: 3 });
    const written = preconditions.readerClosesThePipeAfter(Number.POSITIVE_INFINITY);

    await storiesCommand.parseAsync([
      "node",
      "test",
      "find",
      "--space",
      "12345",
      "--check-references",
      "--limit",
      "1",
    ]);
    const stderr = errorSpy.mock.calls.flat().join("\n");

    expect(written).toHaveLength(1);
    expect(process.exitCode).toBeFalsy();
    expect(stderr).toContain("Results: 1 stories with reference issues");
    expect(stderr).not.toContain("aborted");
  });

  it("should report only the issue types passed to --check-references", async () => {
    preconditions.canCheckReferences();
    const written = preconditions.readerClosesThePipeAfter(Number.POSITIVE_INFINITY);

    await storiesCommand.parseAsync([
      "node",
      "test",
      "find",
      "--space",
      "12345",
      "--check-references",
      "unpublished,stale_url",
    ]);

    // The only issue in the space is a broken link.
    expect(written).toHaveLength(0);
    expect(process.exitCode).toBeFalsy();
  });

  it("should reject an unknown --query operation before any request", async () => {
    await storiesCommand.parseAsync([
      "node",
      "test",
      "find",
      "--space",
      "12345",
      "--query",
      "[category][eq]=technology",
    ]);

    expect(process.exitCode).toBe(2);
    expect(errorSpy.mock.calls.flat().join("\n")).toContain("Unknown --query operation");
  });

  it("should refuse a --where on a field-level translation under --capi-filter, before any request", async () => {
    let requests = 0;
    const countRequest = (): void => {
      requests += 1;
    };
    server.events.on("request:start", countRequest);

    try {
      await storiesCommand.parseAsync([
        "node",
        "test",
        "find",
        "--space",
        "12345",
        "--capi-filter",
        "--where",
        "$[?($.content.title__i18n__de)]",
      ]);
    } finally {
      server.events.removeListener("request:start", countRequest);
    }

    expect(process.exitCode).toBe(2);
    expect(errorSpy.mock.calls.flat().join("\n")).toContain(
      "--capi-filter cannot evaluate --where on field-level translations",
    );
    expect(requests).toBe(0);
  });

  // Placed before the closed-pipe test on purpose: that one leaves stdout closed
  // for the life of the process, and a run after it would stop before any stage
  // had work in flight.
  it("should stop at --limit with exactly that many results, and leave the rest unread", async () => {
    const total = 300;
    preconditions.canFindStories(total, { slow: true });
    const written = preconditions.readerClosesThePipeAfter(Number.POSITIVE_INFINITY);

    let contentFetches = 0;
    const countContentFetch = ({ request }: { request: Request }): void => {
      if (/\/stories\/\d+$/.test(new URL(request.url).pathname)) {
        contentFetches += 1;
      }
    };
    server.events.on("request:start", countContentFetch);

    try {
      await storiesCommand.parseAsync(["node", "test", "find", "--space", "12345", "--limit", "5"]);
    } finally {
      server.events.removeListener("request:start", countContentFetch);
    }

    // Exactly what was asked for: never one short, never one over.
    expect(written).toHaveLength(5);
    // The point of the flag: the rest of the scope is never read.
    expect(contentFetches).toBeLessThan(total);
    const stderr = errorSpy.mock.calls.flat().join("\n");
    expect(stderr).toMatch(/--limit 5 was reached/);
    expect(stderr).not.toMatch(/operation was aborted/i);
    // A limit that was reached is a successful run, so a script can trust this.
    expect(process.exitCode).toBeFalsy();
  });

  // A reader closing the pipe is a deliberate stop: the run exits 0 and reports
  // no failed stage.
  //
  // One test rather than four, because "the reader hung up" is module state that
  // survives for the life of the process: a second run in the same file starts
  // with stdout already closed and aborts before any stage has work in flight,
  // so it exercises none of this. All four consequences of the one run are
  // asserted together instead.
  it("should report a reader closing the pipe as a deliberate stop, not a failure", async () => {
    preconditions.canFindStories(300, { slow: true });
    preconditions.readerClosesThePipeAfter(2);

    await storiesCommand.parseAsync(["node", "test", "find", "--space", "12345"]);
    const stderr = errorSpy.mock.calls.flat().join("\n");

    // Nothing that reads as a failure: no error line, and the teardown of the
    // listing that was still in flight is not counted against it.
    expect(stderr).not.toMatch(/operation was aborted/i);
    expect(stderr).toMatch(/0 page\(s\) failed/);
    // ...an explicit statement that it was on purpose...
    expect(stderr).toMatch(/Stopped early on purpose/);
    // ...and an exit code a script can trust.
    expect(process.exitCode).toBeFalsy();
  });
});
