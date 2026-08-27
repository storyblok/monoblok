import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import {
  createStoryLineSource,
  describeStoryLine,
  hasContent,
  isSidecarKey,
  parseStoryLine,
  stripSidecarKeys,
  type StoryLine,
} from "./contract";

const line = (overrides: Record<string, unknown> = {}): StoryLine =>
  parseStoryLine({ id: 1, uuid: "story-uuid", full_slug: "en/blog/post", ...overrides });

describe("parseStoryLine", () => {
  it("should accept a story carrying the required fields", () => {
    expect(parseStoryLine({ id: 1, uuid: "u", full_slug: "s" })).toEqual({
      id: 1,
      uuid: "u",
      full_slug: "s",
    });
  });

  it("should name every missing field at once", () => {
    expect(() => parseStoryLine({ id: 1 }, 4)).toThrow(/uuid, full_slug/);
    expect(() => parseStoryLine({ id: 1 }, 4)).toThrow(/input line 4/);
  });

  it("should reject anything that is not a story object", () => {
    expect(() => parseStoryLine([{ id: 1 }])).toThrow(/an array/);
    expect(() => parseStoryLine("en/blog/post")).toThrow(/string/);
    expect(() => parseStoryLine(null)).toThrow(/object/);
  });
});

describe("stripSidecarKeys", () => {
  it("should remove the producer's annotations", () => {
    const annotated = line({ _ref_issues: [{ type: "broken" }] });

    expect(stripSidecarKeys(annotated)).not.toHaveProperty("_ref_issues");
    expect(stripSidecarKeys(annotated).full_slug).toBe("en/blog/post");
  });

  // `_uid` and `_editable` are part of the document the API round-trips, so
  // removing them there would corrupt the story rather than clean it.
  it("should leave underscored keys inside content alone", () => {
    const withContent = line({
      content: { _uid: "abc", component: "page", body: [{ _uid: "def", component: "hero" }] },
      _ref_issues: [],
    });

    const story = stripSidecarKeys(withContent);

    expect(story.content).toEqual({
      _uid: "abc",
      component: "page",
      body: [{ _uid: "def", component: "hero" }],
    });
  });
});

describe("hasContent", () => {
  it("should tell a full story apart from list metadata", () => {
    expect(hasContent(line({ content: { component: "page" } }))).toBe(true);
    expect(hasContent(line())).toBe(false);
  });
});

describe("isSidecarKey", () => {
  it("should recognise an annotation by its prefix", () => {
    expect(isSidecarKey("_ref_issues")).toBe(true);
    expect(isSidecarKey("full_slug")).toBe(false);
  });
});

describe("describeStoryLine", () => {
  it("should name a line by id and slug", () => {
    expect(describeStoryLine(line())).toBe("#1 (en/blog/post)");
  });
});

describe("createStoryLineSource", () => {
  it("should read JSONL and validate every line against the contract", async () => {
    const input = Readable.from(['{"id":1,"uuid":"u1","full_slug":"a"}\n']);
    const received: StoryLine[] = [];

    for await (const story of createStoryLineSource({ input })) {
      received.push(story as StoryLine);
    }

    expect(received).toEqual([{ id: 1, uuid: "u1", full_slug: "a" }]);
  });

  it("should fail on a line a filter in the middle of the pipe reshaped", async () => {
    const input = Readable.from(['{"id":1,"uuid":"u1","full_slug":"a"}\n{"full_slug":"b"}\n']);

    await expect(
      (async () => {
        for await (const _story of createStoryLineSource({ input })) {
          // drain
        }
      })(),
    ).rejects.toThrow(/input line 2/);
  });
});
