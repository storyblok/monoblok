import { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { describe, expect, it, vi } from "vitest";
import { capiFilterStream, filterStoriesStream } from "./streams";
import type { CapiContentFetcher, StoryContent } from "./capi";
import type { Story } from "../constants";
import type { ClientFilter } from "./types";

const makeStory = (id: number): Story =>
  ({ id, uuid: `uuid-${id}`, full_slug: `story-${id}` }) as Story;

/** Answers with content for the given ids only; anything else is left out. */
const fetcherFor = (
  contentById: Record<number, Record<string, unknown>>,
): { fetchContent: CapiContentFetcher; batches: string[][] } => {
  const batches: string[][] = [];
  const fetchContent: CapiContentFetcher = async (uuids) => {
    batches.push(uuids);
    const content = new Map<string, StoryContent>();
    for (const [id, value] of Object.entries(contentById)) {
      const uuid = `uuid-${id}`;
      if (uuids.includes(uuid)) {
        content.set(uuid, value as StoryContent);
      }
    }
    return content;
  };
  return { fetchContent, batches };
};

const collect = (received: Story[]) =>
  new Writable({
    objectMode: true,
    write(story: Story, _encoding, callback) {
      received.push(story);
      callback();
    },
  });

const isPage: ClientFilter = (story) => story.content?.component === "page";

describe("capiFilterStream", () => {
  it("discards the CAPI content by default, leaving the story as listed", async () => {
    const { fetchContent } = fetcherFor({ 1: { component: "page" } });
    const received: Story[] = [];

    await pipeline(
      Readable.from([makeStory(1)]),
      capiFilterStream({ fetchContent, filters: [isPage] }),
      collect(received),
    );

    expect(received).toHaveLength(1);
    expect(received[0]?.content).toBeUndefined();
  });

  it("forwards the CAPI content on the story when asked to attach it", async () => {
    const { fetchContent } = fetcherFor({ 1: { component: "page", headline: "Hi" } });
    const received: Story[] = [];

    await pipeline(
      Readable.from([makeStory(1)]),
      capiFilterStream({ fetchContent, filters: [isPage], attachContent: true }),
      collect(received),
    );

    expect(received[0]?.content).toEqual({ component: "page", headline: "Hi" });
  });

  it("strips editor markers from attached content, but still filters on it", async () => {
    const { fetchContent } = fetcherFor({
      1: { component: "page", _editable: "<!--#storyblok#{}-->" },
    });
    const received: Story[] = [];
    const matchesEditable: ClientFilter = (story) =>
      typeof (story.content as { _editable?: string } | undefined)?._editable === "string";

    await pipeline(
      Readable.from([makeStory(1)]),
      capiFilterStream({ fetchContent, filters: [matchesEditable], attachContent: true }),
      collect(received),
    );

    // Matched on `_editable`, so the filter saw the content as served...
    expect(received).toHaveLength(1);
    // ...but what it forwarded no longer carries it.
    expect(received[0]?.content).toEqual({ component: "page" });
  });

  it("forwards a story the CDN has no content for without inventing any", async () => {
    const { fetchContent } = fetcherFor({});
    const received: Story[] = [];
    const onUnresolved = vi.fn();

    await pipeline(
      Readable.from([makeStory(1)]),
      capiFilterStream({ fetchContent, filters: [isPage], attachContent: true, onUnresolved }),
      collect(received),
    );

    expect(onUnresolved).toHaveBeenCalledTimes(1);
    expect(received[0]?.content).toBeUndefined();
  });

  it("passes candidates through and prunes the rest", async () => {
    const { fetchContent } = fetcherFor({
      1: { component: "page" },
      2: { component: "post" },
      3: { component: "page" },
    });
    const received: Story[] = [];
    const onPruned = vi.fn();
    const onCandidate = vi.fn();

    await pipeline(
      Readable.from([makeStory(1), makeStory(2), makeStory(3)]),
      capiFilterStream({
        fetchContent,
        filters: [isPage],
        batchSize: 2,
        onCandidate,
        onPruned,
      }),
      collect(received),
    );

    expect(received.map((story) => story.id)).toEqual([1, 3]);
    expect(onCandidate).toHaveBeenCalledTimes(2);
    expect(onPruned).toHaveBeenCalledTimes(1);
  });

  it("emits the listed story, not the CAPI merge, so the MAPI fetch stays authoritative", async () => {
    const { fetchContent } = fetcherFor({
      1: { component: "page", _editable: "<!--#storyblok-->" },
    });
    const received: Story[] = [];

    await pipeline(
      Readable.from([makeStory(1)]),
      capiFilterStream({ fetchContent, filters: [isPage] }),
      collect(received),
    );

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(makeStory(1));
    expect(received[0].content).toBeUndefined();
  });

  it("batches by the configured size and sends the partial tail", async () => {
    const { fetchContent, batches } = fetcherFor({});
    const received: Story[] = [];

    await pipeline(
      Readable.from([1, 2, 3, 4, 5].map(makeStory)),
      capiFilterStream({ fetchContent, filters: [isPage], batchSize: 2 }),
      collect(received),
    );

    expect(batches).toEqual([["uuid-1", "uuid-2"], ["uuid-3", "uuid-4"], ["uuid-5"]]);
  });

  it("passes a story CAPI has no content for through undecided", async () => {
    // Folders are the everyday case: the CDN has no content for them, and a
    // pruning stage would drop them from a result set they belong in.
    const { fetchContent } = fetcherFor({ 1: { component: "page" } });
    const received: Story[] = [];
    const onUnresolved = vi.fn();
    const onPruned = vi.fn();

    await pipeline(
      Readable.from([makeStory(1), makeStory(2)]),
      capiFilterStream({
        fetchContent,
        filters: [isPage],
        onUnresolved,
        onPruned,
      }),
      collect(received),
    );

    expect(received.map((story) => story.id)).toEqual([1, 2]);
    expect(onUnresolved).toHaveBeenCalledTimes(1);
    expect(onPruned).not.toHaveBeenCalled();
  });

  it("reports a failed batch and prunes nothing from it", async () => {
    const fetchContent: CapiContentFetcher = () => Promise.reject(new Error("CDN unavailable"));
    const received: Story[] = [];
    const onBatchError = vi.fn();

    await pipeline(
      Readable.from([makeStory(1), makeStory(2)]),
      capiFilterStream({ fetchContent, filters: [isPage], onBatchError }),
      collect(received),
    );

    expect(received.map((story) => story.id)).toEqual([1, 2]);
    expect(onBatchError).toHaveBeenCalledTimes(1);
    expect(onBatchError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onBatchError.mock.calls[0][1]).toBe(2);
  });

  it("does not prune on a filter that throws", async () => {
    const { fetchContent } = fetcherFor({ 1: { component: "page" } });
    const throwing: ClientFilter = () => {
      throw new Error("bad expression");
    };
    const received: Story[] = [];
    const onUnresolved = vi.fn();

    await pipeline(
      Readable.from([makeStory(1)]),
      capiFilterStream({ fetchContent, filters: [throwing], onUnresolved }),
      collect(received),
    );

    expect(received.map((story) => story.id)).toEqual([1]);
    expect(onUnresolved).toHaveBeenCalledTimes(1);
  });

  it("filters on story-level properties, which arrive with the list response", async () => {
    const { fetchContent } = fetcherFor({ 1: { component: "page" }, 2: { component: "page" } });
    const received: Story[] = [];
    const isSecond: ClientFilter = (story) => story.full_slug === "story-2";

    await pipeline(
      Readable.from([makeStory(1), makeStory(2)]),
      capiFilterStream({ fetchContent, filters: [isSecond] }),
      collect(received),
    );

    expect(received.map((story) => story.id)).toEqual([2]);
  });
});

describe("filterStoriesStream", () => {
  const withContent = (id: number, component: string): Story =>
    ({ ...makeStory(id), content: { component } }) as Story;

  it("applies the filters to every story by default", async () => {
    const matched: number[] = [];
    const skipped: number[] = [];
    const received: Story[] = [];

    await pipeline(
      Readable.from([withContent(1, "page"), withContent(2, "post")]),
      filterStoriesStream({
        filters: [isPage],
        onMatch: (story) => matched.push(story.id),
        onSkip: (story) => skipped.push(story.id),
      }),
      collect(received),
    );

    expect(matched).toEqual([1]);
    expect(skipped).toEqual([2]);
    // What it pushes is what the sink writes out, so a slow reader paces the run.
    expect(received.map((story) => story.id)).toEqual([1]);
  });

  it("takes an upstream match as final, without evaluating the filters again", async () => {
    // What --capi-filter relies on: the CAPI pass already tested story 2's
    // content, so its verdict stands even though this filter would reject it.
    const evaluated: number[] = [];
    const isPageCounting: ClientFilter = (story) => {
      evaluated.push(story.id);
      return isPage(story);
    };
    const matched: number[] = [];
    const received: Story[] = [];

    await pipeline(
      Readable.from([withContent(1, "page"), withContent(2, "post"), withContent(3, "post")]),
      filterStoriesStream({
        filters: [isPageCounting],
        isAlreadyMatched: (story) => story.id === 2,
        onMatch: (story) => matched.push(story.id),
      }),
      collect(received),
    );

    expect(matched).toEqual([1, 2]);
    expect(evaluated).toEqual([1, 3]);
    expect(received.map((story) => story.id)).toEqual([1, 2]);
  });

  it("still filters the stories the upstream stage could not settle", async () => {
    const matched: number[] = [];
    const skipped: number[] = [];
    const received: Story[] = [];

    await pipeline(
      Readable.from([withContent(1, "page"), withContent(2, "post")]),
      filterStoriesStream({
        filters: [isPage],
        // Nothing was settled upstream, as for a folder or a CDN miss.
        isAlreadyMatched: () => false,
        onMatch: (story) => matched.push(story.id),
        onSkip: (story) => skipped.push(story.id),
      }),
      collect(received),
    );

    expect(matched).toEqual([1]);
    expect(skipped).toEqual([2]);
    expect(received.map((story) => story.id)).toEqual([1]);
  });

  it("drops a story whose filter throws, without ending the run", async () => {
    const explodes: ClientFilter = (story) => {
      if (story.id === 2) {
        throw new Error("bad expression");
      }
      return true;
    };
    const errors: number[] = [];
    const received: Story[] = [];

    await pipeline(
      Readable.from([withContent(1, "page"), withContent(2, "post"), withContent(3, "post")]),
      filterStoriesStream({
        filters: [explodes],
        onStoryError: (_error, story) => errors.push(story.id),
      }),
      collect(received),
    );

    expect(errors).toEqual([2]);
    expect(received.map((story) => story.id)).toEqual([1, 3]);
  });
});
