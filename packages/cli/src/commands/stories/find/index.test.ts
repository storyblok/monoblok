import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { vol } from "memfs";
// Import the parent module first so the subcommand registers on it.
import "../index";
import { storiesCommand } from "../command";
import { makeMockStory, type MockStory } from "../__tests__/helpers";

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
  canFindStories(count: number, { slow = false }: { slow?: boolean } = {}) {
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
          return HttpResponse.json({ story });
        }),
      );
    }
    return stories;
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

  // Regression: aborting the pipeline tears every in-flight stage down at once,
  // and each one reported that teardown through its own error callback. The run
  // printed "▲ error The operation was aborted", counted a failed listing page,
  // and exited 1 — for what is a complete, deliberate use of the command.
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
