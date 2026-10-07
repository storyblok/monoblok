import { describe, expect, it } from "vitest";
import { applyMigration, type StoryForMigration } from "./apply-migration";
import { defineMigration, type MigrationOps } from "./define-migration";
import { alterBlock, alterField, renameBlock, renameField, splitField } from "./ops";
import type { SchemaShape } from "./types";

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

describe("applyMigration across ops and reruns", () => {
  function storyWith(body: unknown[]): StoryForMigration {
    return { id: 1, slug: "home", content: { _uid: "r", component: "page", body } };
  }

  function run(ops: MigrationOps<SchemaShape, SchemaShape>, story: StoryForMigration) {
    return applyMigration({
      migration: defineMigration<SchemaShape>(ops),
      id: "0001-x",
      space: "1",
      stories: [story],
    });
  }

  it("should address every op to the name the block had before the migration", () => {
    const outcome = run(
      [renameBlock({ block: "a", to: "b" }), renameField({ block: "a", field: "x", to: "y" })],
      storyWith([{ _uid: "k", component: "a", x: 1 }]),
    );

    expect(outcome.refusals).toEqual([]);
    expect(outcome.writes[0].content).toMatchObject({ body: [{ component: "b", y: 1 }] });
  });

  it("should refuse an op addressed to a name an earlier op introduced, which only a rerun would reach", () => {
    const outcome = run(
      [renameBlock({ block: "a", to: "b" }), renameField({ block: "b", field: "x", to: "y" })],
      storyWith([{ _uid: "k", component: "a", x: 1 }]),
    );

    expect(outcome.writes).toEqual([]);
    expect(outcome.refusals[0].reason).toMatch(/op 1 \(renameField\) on block k changed it again/);
  });

  it("should apply a later op to children an earlier `alterBlock` replaced", () => {
    const outcome = run(
      [
        alterBlock({ block: "page" }, (page: Record<string, unknown>) => ({
          ...page,
          body: (page.body as Record<string, unknown>[]).map((child) => ({ ...child })),
        })),
        renameField({ block: "card", field: "x", to: "y" }),
      ],
      storyWith([{ _uid: "k", component: "card", x: 1 }]),
    );

    expect(outcome.writes[0].content).toMatchObject({ body: [{ y: 1 }] });
  });

  it("should refuse a rename onto a field that already holds a value", () => {
    const outcome = run(
      [renameField({ block: "card", field: "headline", to: "subtitle" })],
      storyWith([{ _uid: "k", component: "card", headline: "A", subtitle: "B" }]),
    );

    expect(outcome.writes).toEqual([]);
    expect(outcome.refusals[0].reason).toMatch(/"subtitle" already holds a value/);
  });

  it("should rename onto a field that is present but empty", () => {
    const outcome = run(
      [renameField({ block: "card", field: "headline", to: "subtitle" })],
      storyWith([{ _uid: "k", component: "card", headline: "A", subtitle: "" }]),
    );

    expect(outcome.writes[0].content).toMatchObject({ body: [{ subtitle: "A" }] });
  });

  it("should let a rerun of a rename chain refuse rather than destroy data", () => {
    const chain: MigrationOps<SchemaShape, SchemaShape> = [
      renameField({ block: "card", field: "title", to: "headline" }),
      renameField({ block: "card", field: "subtitle", to: "title" }),
    ];
    const first = run(
      chain,
      storyWith([{ _uid: "k", component: "card", title: "Main", subtitle: "Sub" }]),
    );
    expect(first.writes[0].content).toMatchObject({ body: [{ headline: "Main", title: "Sub" }] });

    const second = run(chain, { ...first.writes[0].story, content: first.writes[0].content });

    expect(second.writes).toEqual([]);
    expect(second.refusals[0].reason).toMatch(/"headline" already holds a value/);
  });

  it("should refuse an `alterBlock` result that drops the block's `_uid` or `component`", () => {
    const outcome = run(
      [
        alterBlock(
          { block: "card" },
          (card: Record<string, unknown>) => ({ title: String(card.title).trim() }) as never,
        ),
      ],
      storyWith([{ _uid: "k", component: "card", title: " x " }]),
    );

    expect(outcome.writes).toEqual([]);
    expect(outcome.refusals[0].reason).toMatch(/op 0 \(alterBlock\) on block k was refused/);
  });

  it("should refuse a story whose shadowed duplicate uid is the one the migration targets", () => {
    const outcome = run(
      [renameField({ block: "card", field: "title", to: "headline" })],
      storyWith([
        { _uid: "dup", component: "card", title: "T" },
        { _uid: "dup", component: "text" },
      ]),
    );

    expect(outcome.writes).toEqual([]);
    expect(outcome.refusals[0].reason).toMatch(/already contains repeated block ids/);
  });

  it("should refuse a story whose callback throws and name the op and block", () => {
    const outcome = run(
      [alterField({ block: "card", field: "title" }, (value) => (value as string).toUpperCase())],
      storyWith([{ _uid: "k", component: "card", title: 42 }]),
    );

    expect(outcome.writes).toEqual([]);
    expect(outcome.refusals[0].reason).toMatch(
      /op 0 \(alterField\) on block k .*the callback threw/,
    );
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
