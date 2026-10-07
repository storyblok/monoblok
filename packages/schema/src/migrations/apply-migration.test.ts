import { describe, expect, it } from "vitest";
import { applyMigration, type StoryForMigration } from "./apply-migration";
import { defineMigration } from "./define-migration";
import { alterField, renameField, splitField } from "./ops";

const migration = defineMigration([renameField({ block: "card", field: "title", to: "headline" })]);

const stories: StoryForMigration[] = [
  {
    id: 1,
    slug: "home",
    content: {
      _uid: "r1",
      component: "page",
      body: [{ _uid: "a", component: "card", title: "Hi" }],
    },
  },
  { id: 2, slug: "about", content: { _uid: "r2", component: "page", body: [] } },
];

describe("applyMigration", () => {
  it("should collect a write for every story the migration changed and none for the rest", () => {
    const outcome = applyMigration({
      migration,
      id: "0001-rename",
      space: "12345",
      stories,
    });

    expect(outcome.writes).toHaveLength(1);
    expect(outcome.writes[0].story.slug).toBe("home");
    expect(outcome.writes[0].content).toMatchObject({
      body: [{ _uid: "a", component: "card", headline: "Hi" }],
    });
  });

  it("should count the run for the journal", () => {
    const outcome = applyMigration({
      migration,
      id: "0001-rename",
      space: "12345",
      stories,
    });

    expect(outcome.run).toMatchObject({
      space: "12345",
      migration: "0001-rename",
      stories: 1,
      blocks: 1,
    });
    expect(outcome.inverse).toEqual([
      expect.objectContaining({ story: 1, patches: expect.any(Array) }),
    ]);
  });

  it("should record the inverse that turns the migrated content back into the original", () => {
    const outcome = applyMigration({
      migration,
      id: "0001-rename",
      space: "12345",
      stories,
    });

    expect(outcome.inverse[0].patches).toEqual([
      expect.objectContaining({
        uid: "a",
        ops: expect.arrayContaining([
          expect.objectContaining({ kind: "set", key: "title", value: "Hi" }),
          expect.objectContaining({ kind: "unset", key: "headline" }),
        ]),
      }),
    ]);
  });

  it("should refuse a story that already contained repeated block ids and write nothing for it", () => {
    const outcome = applyMigration({
      migration,
      id: "0001-rename",
      space: "12345",
      stories: [
        {
          id: 3,
          slug: "broken",
          content: {
            _uid: "r3",
            component: "page",
            body: [
              { _uid: "dup", component: "card", title: "one" },
              { _uid: "dup", component: "card", title: "two" },
            ],
          },
        },
      ],
    });

    expect(outcome.writes).toHaveLength(0);
    expect(outcome.inverse).toHaveLength(0);
    expect(outcome.refusals).toEqual([
      { slug: "broken", reason: expect.stringContaining("already contains repeated block ids") },
    ]);
    expect(outcome.refusals[0].reason).toContain("dup");
  });

  it("should refuse a story whose reshaped field is translated and write nothing for it", () => {
    const splitName = defineMigration([
      splitField({ block: "author", field: "name", into: ["first_name", "last_name"] }, (value) =>
        String(value).split(" "),
      ),
    ]);

    const outcome = applyMigration({
      migration: splitName,
      id: "0001-split-name",
      space: "12345",
      stories: [
        {
          id: 1,
          slug: "home",
          content: {
            _uid: "r1",
            component: "page",
            body: [
              {
                _uid: "a",
                component: "author",
                name: "Ada Lovelace",
                name__i18n__de: "Ada von Lovelace",
              },
            ],
          },
        },
      ],
    });

    expect(outcome.writes).toEqual([]);
    expect(outcome.refusals).toEqual([
      { slug: "home", reason: expect.stringContaining("translated") },
    ]);
  });

  it("should refuse a story whose migration keeps changing it on a rerun", () => {
    const appending = defineMigration([
      alterField({ block: "card", field: "title" }, (value) => `${String(value)}!`),
    ]);

    const outcome = applyMigration({
      migration: appending,
      id: "0002-append",
      space: "12345",
      stories,
    });

    expect(outcome.writes).toHaveLength(0);
    expect(outcome.refusals[0]).toMatchObject({ slug: "home" });
    expect(outcome.refusals[0].reason).toMatch(/second pass/);
  });

  it("should leave the story content it was handed untouched", () => {
    applyMigration({
      migration,
      id: "0001-rename",
      space: "12345",
      stories,
    });

    expect(stories[0].content).toMatchObject({
      body: [{ _uid: "a", component: "card", title: "Hi" }],
    });
  });
});

describe("applyMigration publish state", () => {
  const card = (uid: string) => ({
    _uid: `root-${uid}`,
    component: "page",
    body: [{ _uid: uid, component: "card", title: "Hi" }],
  });
  const draft: StoryForMigration = {
    id: 1,
    slug: "draft",
    content: card("a"),
    published: false,
    unpublished_changes: true,
  };
  const live: StoryForMigration = {
    id: 2,
    slug: "live",
    content: card("b"),
    published: true,
    unpublished_changes: false,
  };
  const liveWithChanges: StoryForMigration = {
    id: 3,
    slug: "live-with-changes",
    content: card("c"),
    published: true,
    unpublished_changes: true,
  };
  const all = [draft, live, liveWithChanges];

  const publishedSlugs = (publish?: "all" | "published" | "published-with-changes") =>
    applyMigration({ migration, id: "0001-rename", space: "12345", stories: all, publish })
      .writes.filter((write) => write.publish)
      .map((write) => write.story.slug);

  it("should publish nothing without a publish mode", () => {
    expect(publishedSlugs()).toEqual([]);
  });

  it("should publish every written story under `all`", () => {
    expect(publishedSlugs("all")).toEqual(["draft", "live", "live-with-changes"]);
  });

  it("should publish only stories whose live version matched the draft under `published`", () => {
    expect(publishedSlugs("published")).toEqual(["live"]);
  });

  it("should publish only stories with pending changes under `published-with-changes`", () => {
    expect(publishedSlugs("published-with-changes")).toEqual(["live-with-changes"]);
  });

  it("should count published stories written as drafts only, so their live shape is flagged", () => {
    const outcome = applyMigration({
      migration,
      id: "0001-rename",
      space: "12345",
      stories: all,
      publish: "published",
    });

    expect(outcome.publishedDraftOnly).toBe(1);
  });

  it("should record each story's publish state and whether the run published it", () => {
    const outcome = applyMigration({
      migration,
      id: "0001-rename",
      space: "12345",
      stories: all,
      publish: "published",
    });

    expect(
      outcome.inverse.map(({ story, before, publishedByRun }) => ({
        story,
        before,
        publishedByRun,
      })),
    ).toEqual([
      { story: 1, before: { published: false, unpublishedChanges: true }, publishedByRun: false },
      { story: 2, before: { published: true, unpublishedChanges: false }, publishedByRun: true },
      { story: 3, before: { published: true, unpublishedChanges: true }, publishedByRun: false },
    ]);
  });

  it("should treat a story without publish fields as an unpublished draft", () => {
    const outcome = applyMigration({
      migration,
      id: "0001-rename",
      space: "12345",
      stories: [{ id: 4, slug: "bare", content: card("d") }],
      publish: "published",
    });

    expect(outcome.writes[0].publish).toBe(false);
    expect(outcome.publishedDraftOnly).toBe(0);
  });
});

describe("applyMigration run record", () => {
  it("should give the run a journal id derived from the migration and the time it was applied", () => {
    const appliedAt = new Date("2026-10-07T12:00:00.000Z");
    const outcome = applyMigration({
      migration,
      id: "0001-rename",
      space: "12345",
      stories,
      appliedAt,
    });

    expect(outcome.run.id).toBe("2026-10-07T12-00-00-000Z-0001-rename");
    expect(outcome.run.appliedAt).toBe("2026-10-07T12:00:00.000Z");
  });
});
