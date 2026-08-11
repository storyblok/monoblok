import { describe, expect, it } from "vitest";
import type { Component } from "../../../types";
import type { Story } from "../constants";
import { buildRelationFieldMap, detectIssues, extractReferences } from "./references";
import type { RefEntry, TargetMeta } from "./references";

const UUID_A = "11111111-1111-1111-1111-111111111111";
const UUID_B = "22222222-2222-2222-2222-222222222222";
const UUID_C = "33333333-3333-3333-3333-333333333333";

function makeComponent(name: string, schema: Record<string, Record<string, unknown>>): Component {
  return {
    id: 1,
    name,
    schema,
    created_at: "",
    updated_at: "",
    is_root: false,
    is_nestable: true,
  } as Component;
}

function makeStory(content: Record<string, unknown>): Story {
  return { id: 1, uuid: UUID_A, full_slug: "test", content, is_published: true } as Story;
}

describe("buildRelationFieldMap", () => {
  it("picks up option/options fields with source internal_stories", () => {
    const components = [
      makeComponent("post", {
        author: { type: "option", source: "internal_stories" },
        categories: { type: "options", source: "internal_stories" },
        title: { type: "text" },
      }),
    ];
    const map = buildRelationFieldMap(components);
    expect(map.get("post")).toEqual(new Set(["author", "categories"]));
  });

  it("ignores option fields with other sources", () => {
    const components = [
      makeComponent("post", {
        status: { type: "option", source: "self" },
        region: { type: "option", source: "internal" },
        color: { type: "option" },
      }),
    ];
    const map = buildRelationFieldMap(components);
    expect(map.has("post")).toBe(false);
  });

  it("ignores non-option field types", () => {
    const components = [
      makeComponent("post", {
        title: { type: "text" },
        body: { type: "richtext" },
        image: { type: "asset" },
      }),
    ];
    const map = buildRelationFieldMap(components);
    expect(map.size).toBe(0);
  });
});

describe("extractReferences", () => {
  const emptyRelMap = new Map();

  it("extracts multilink story references", () => {
    const story = makeStory({
      component: "page",
      link: { fieldtype: "multilink", linktype: "story", id: UUID_B, cached_url: "/target" },
    });
    const refs = extractReferences(story, emptyRelMap);
    expect(refs).toEqual([
      {
        targetUuid: UUID_B,
        refType: "multilink",
        fieldPath: "content.link",
        cachedUrl: "/target",
      },
    ]);
  });

  it("extracts richtext link marks", () => {
    const story = makeStory({
      component: "page",
      body: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                marks: [
                  {
                    type: "link",
                    attrs: { linktype: "story", uuid: UUID_B, href: "/linked" },
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    const refs = extractReferences(story, emptyRelMap);
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      targetUuid: UUID_B,
      refType: "richtext",
      cachedUrl: "/linked",
    });
  });

  it("extracts single-option relation fields", () => {
    const relMap = new Map([["post", new Set(["author"])]]);
    const story = makeStory({ component: "post", author: UUID_B, title: "Hello" });
    const refs = extractReferences(story, relMap);
    expect(refs).toEqual([
      {
        targetUuid: UUID_B,
        refType: "relation",
        fieldPath: "content.author",
      },
    ]);
  });

  it("extracts multi-option relation fields", () => {
    const relMap = new Map([["post", new Set(["categories"])]]);
    const story = makeStory({ component: "post", categories: [UUID_B, UUID_C] });
    const refs = extractReferences(story, relMap);
    expect(refs).toHaveLength(2);
    expect(refs[0]).toMatchObject({ targetUuid: UUID_B, fieldPath: "content.categories[0]" });
    expect(refs[1]).toMatchObject({ targetUuid: UUID_C, fieldPath: "content.categories[1]" });
  });

  it("does not extract _uid as a relation", () => {
    const relMap = new Map([["post", new Set(["author"])]]);
    const story = makeStory({ component: "post", _uid: UUID_B, author: UUID_C });
    const refs = extractReferences(story, relMap);
    expect(refs).toHaveLength(1);
    expect(refs[0].targetUuid).toBe(UUID_C);
  });

  it("propagates component name into nested blocks", () => {
    const relMap = new Map([["hero", new Set(["cta_target"])]]);
    const story = makeStory({
      component: "page",
      body: [
        {
          component: "hero",
          _uid: "some-uid",
          cta_target: UUID_B,
        },
      ],
    });
    const refs = extractReferences(story, relMap);
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ targetUuid: UUID_B, refType: "relation" });
  });

  it("ignores non-story multilink", () => {
    const story = makeStory({
      component: "page",
      link: {
        fieldtype: "multilink",
        linktype: "url",
        url: "https://example.com",
        cached_url: "https://example.com",
      },
    });
    const refs = extractReferences(story, emptyRelMap);
    expect(refs).toHaveLength(0);
  });

  it("ignores asset field UUIDs", () => {
    const story = makeStory({
      component: "page",
      image: { fieldtype: "asset", id: UUID_B, filename: "test.jpg", alt: "" },
    });
    const refs = extractReferences(story, emptyRelMap);
    expect(refs).toHaveLength(0);
  });
});

describe("detectIssues", () => {
  it("returns broken for missing target", () => {
    const refs: RefEntry[] = [
      {
        targetUuid: UUID_B,
        refType: "multilink",
        fieldPath: "content.link",
        cachedUrl: "/target",
      },
    ];
    const targetMap = new Map<string, TargetMeta>();
    const issues = detectIssues(refs, targetMap);
    expect(issues).toEqual([
      {
        type: "broken",
        ref_type: "multilink",
        target_uuid: UUID_B,
        cached_url: "/target",
        field_path: "content.link",
      },
    ]);
  });

  it("returns unpublished for unpublished target", () => {
    const refs: RefEntry[] = [
      {
        targetUuid: UUID_B,
        refType: "multilink",
        fieldPath: "content.link",
        cachedUrl: "/target",
      },
    ];
    const targetMap = new Map<string, TargetMeta>([
      [UUID_B, { full_slug: "target", is_published: false }],
    ]);
    const issues = detectIssues(refs, targetMap);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe("unpublished");
    expect(issues[0].actual_url).toBe("target");
  });

  it("returns stale_url for mismatched cached_url", () => {
    const refs: RefEntry[] = [
      {
        targetUuid: UUID_B,
        refType: "multilink",
        fieldPath: "content.link",
        cachedUrl: "/old/path",
      },
    ];
    const targetMap = new Map<string, TargetMeta>([
      [UUID_B, { full_slug: "new/path", is_published: true }],
    ]);
    const issues = detectIssues(refs, targetMap);
    expect(issues).toEqual([
      {
        type: "stale_url",
        ref_type: "multilink",
        target_uuid: UUID_B,
        cached_url: "/old/path",
        actual_url: "new/path",
        field_path: "content.link",
      },
    ]);
  });

  it("returns no issue when cached_url matches (with slash normalization)", () => {
    const refs: RefEntry[] = [
      {
        targetUuid: UUID_B,
        refType: "multilink",
        fieldPath: "content.link",
        cachedUrl: "/target/path/",
      },
    ];
    const targetMap = new Map<string, TargetMeta>([
      [UUID_B, { full_slug: "target/path", is_published: true }],
    ]);
    const issues = detectIssues(refs, targetMap);
    expect(issues).toHaveLength(0);
  });

  it("broken takes priority — no stale_url for missing target", () => {
    const refs: RefEntry[] = [
      {
        targetUuid: UUID_B,
        refType: "multilink",
        fieldPath: "content.link",
        cachedUrl: "/old/path",
      },
    ];
    const targetMap = new Map<string, TargetMeta>();
    const issues = detectIssues(refs, targetMap);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe("broken");
  });

  it("relation ref with missing target yields broken without stale_url", () => {
    const refs: RefEntry[] = [
      {
        targetUuid: UUID_B,
        refType: "relation",
        fieldPath: "content.author",
      },
    ];
    const targetMap = new Map<string, TargetMeta>();
    const issues = detectIssues(refs, targetMap);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ type: "broken", ref_type: "relation" });
    expect(issues[0].cached_url).toBeUndefined();
  });
});
