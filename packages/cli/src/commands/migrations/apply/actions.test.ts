import { alterField, defineMigration, renameField } from "@storyblok/schema/migrations";
import { describe, expect, it } from "vitest";
import { applyMigration, type StoryForMigration } from "./actions";

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
  it("should collect a write for every story the migration changed and none for the rest", async () => {
    const outcome = await applyMigration({
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

  it("should count the run for the journal", async () => {
    const outcome = await applyMigration({
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
    expect(outcome.inverse).toEqual([{ story: "1", patches: expect.any(Array) }]);
  });

  it("should record the inverse that turns the migrated content back into the original", async () => {
    const outcome = await applyMigration({
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

  it("should refuse a story that already contained repeated block ids and write nothing for it", async () => {
    const outcome = await applyMigration({
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

  it("should refuse a story whose migration keeps changing it on a rerun", async () => {
    const appending = defineMigration([
      alterField({ block: "card", field: "title" }, (value) => `${String(value)}!`),
    ]);

    const outcome = await applyMigration({
      migration: appending,
      id: "0002-append",
      space: "12345",
      stories,
    });

    expect(outcome.writes).toHaveLength(0);
    expect(outcome.refusals[0]).toMatchObject({ slug: "home" });
    expect(outcome.refusals[0].reason).toMatch(/second pass/);
  });

  it("should leave the story content it was handed untouched", async () => {
    await applyMigration({
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
