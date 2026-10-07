import { describe, expect, it, vi } from "vitest";
import type { StoryForMigration } from "./apply-migration";
import type { Journal, MigrationRun, StoryInverse } from "./journal";
import type { BlockPatch } from "./patch";
import { planUndo, undoStories } from "./undo-run";

function journalHolding(runs: MigrationRun[], inverse: Record<string, StoryInverse[]>): Journal {
  return {
    record: vi.fn(),
    list: async () => runs,
    read: async (id) => runs.find((entry) => entry.id === id),
    readInverse: async (id) => inverse[id] ?? [],
  };
}

const run: MigrationRun = {
  id: "run-1",
  space: "12345",
  migration: "0001-rename",
  appliedAt: "2026-09-23T10:00:00.000Z",
  stories: 1,
  blocks: 1,
};

function entry(story: number, patches: BlockPatch[], publishedByRun = false): StoryInverse {
  return {
    story,
    patches,
    before: { published: publishedByRun, unpublishedChanges: false },
    publishedByRun,
  };
}

function home(body: unknown[], overrides: Partial<StoryForMigration> = {}): StoryForMigration {
  return { id: 1, slug: "home", content: { _uid: "r", component: "page", body }, ...overrides };
}

const renameBack: BlockPatch = {
  uid: "a",
  component: "card",
  ops: [
    { kind: "set", key: "title", value: "Hi" },
    { kind: "unset", key: "headline", expect: "Hi" },
  ],
};

const restoreTitle = (uid: string): BlockPatch => ({
  uid,
  component: "card",
  ops: [{ kind: "set", key: "title", value: "Hi", expect: "Hi" }],
});

describe("planUndo", () => {
  it("should name every story the run recorded", async () => {
    const journal = journalHolding([run], {
      "run-1": [entry(1, [renameBack]), entry(2, [renameBack])],
    });

    const plan = await planUndo({ journal, space: "12345", id: "run-1" });

    expect(plan.run).toEqual(run);
    expect(plan.stories).toEqual([1, 2]);
  });

  it("should throw for a run id the journal does not hold", async () => {
    const journal = journalHolding([run], {});

    await expect(planUndo({ journal, space: "12345", id: "no-such-run" })).rejects.toThrow(
      /no-such-run/,
    );
  });

  it("should throw for a run recorded against a different space", async () => {
    const journal = journalHolding([run], { "run-1": [] });

    await expect(planUndo({ journal, space: "99999", id: "run-1" })).rejects.toThrow(
      /recorded for space 12345, not space 99999/,
    );
  });
});

describe("undoStories", () => {
  it("should replay the recorded inverse against current content", () => {
    const outcome = undoStories({
      inverse: [entry(1, [renameBack])],
      stories: [home([{ _uid: "a", component: "card", headline: "Hi" }])],
    });

    expect(outcome.conflicts).toEqual([]);
    expect(outcome.writes).toEqual([
      expect.objectContaining({
        content: expect.objectContaining({ body: [{ _uid: "a", component: "card", title: "Hi" }] }),
      }),
    ]);
  });

  it("should leave the story it was handed untouched, so a failed write cannot half-apply", () => {
    const story = home([{ _uid: "a", component: "card", headline: "Hi" }]);

    undoStories({ inverse: [entry(1, [renameBack])], stories: [story] });

    expect(story.content).toEqual({
      _uid: "r",
      component: "page",
      body: [{ _uid: "a", component: "card", headline: "Hi" }],
    });
  });

  it("should count one conflicting block once however many of its fields the run changed", () => {
    const outcome = undoStories({
      inverse: [
        entry(1, [
          {
            uid: "a",
            component: "card",
            ops: [
              { kind: "set", key: "title", value: "Hi", expect: "Hi" },
              { kind: "unset", key: "headline", expect: "Hi" },
            ],
          },
        ]),
      ],
      stories: [home([{ _uid: "a", component: "card", title: "edited since" }])],
    });

    expect(outcome.conflicts).toEqual([{ slug: "home", count: 1 }]);
    expect(outcome.writes).toEqual([]);
  });

  it("should overwrite a conflicting block under force and still report it", () => {
    const outcome = undoStories({
      inverse: [entry(1, [restoreTitle("a")])],
      stories: [home([{ _uid: "a", component: "card", title: "edited since" }])],
      force: true,
    });

    expect(outcome.conflicts).toEqual([{ slug: "home", count: 1 }]);
    expect(outcome.writes[0]?.content).toMatchObject({
      body: [{ _uid: "a", component: "card", title: "Hi" }],
    });
  });

  it("should report blocks the story no longer holds and offer no write for them", () => {
    const outcome = undoStories({
      inverse: [
        entry(1, [
          { uid: "gone", component: "card", ops: [{ kind: "set", key: "title", value: "Hi" }] },
        ]),
      ],
      stories: [home([])],
    });

    expect(outcome.missing).toEqual([{ slug: "home", count: 1 }]);
    expect(outcome.conflicts).toEqual([]);
    expect(outcome.writes).toEqual([]);
  });

  it("should still write the blocks it could undo in a story that also has a conflict", () => {
    const outcome = undoStories({
      inverse: [
        entry(1, [
          { uid: "a", component: "card", ops: [{ kind: "set", key: "title", value: "Hi" }] },
          restoreTitle("b"),
        ]),
      ],
      stories: [
        home([
          { _uid: "a", component: "card" },
          { _uid: "b", component: "card", title: "edited since" },
        ]),
      ],
    });

    expect(outcome.conflicts).toEqual([{ slug: "home", count: 1 }]);
    expect(outcome.writes[0]?.content).toMatchObject({
      body: [
        { _uid: "a", component: "card", title: "Hi" },
        { _uid: "b", component: "card", title: "edited since" },
      ],
    });
  });

  it("should report recorded stories it was not handed instead of skipping them silently", () => {
    const outcome = undoStories({
      inverse: [entry(1, [renameBack]), entry(2, [renameBack])],
      stories: [home([{ _uid: "a", component: "card", headline: "Hi" }])],
    });

    expect(outcome.writes.map((write) => write.story.id)).toEqual([1]);
    expect(outcome.unread).toEqual([2]);
  });

  it("should republish a story the run published", () => {
    const outcome = undoStories({
      inverse: [entry(1, [renameBack], true)],
      stories: [
        home([{ _uid: "a", component: "card", headline: "Hi" }], {
          published: true,
          unpublished_changes: false,
        }),
      ],
    });

    expect(outcome.writes[0]?.publish).toBe(true);
    expect(outcome.notRepublished).toEqual([]);
  });

  it("should not publish a story the run left as a draft", () => {
    const outcome = undoStories({
      inverse: [entry(1, [renameBack], false)],
      stories: [
        home([{ _uid: "a", component: "card", headline: "Hi" }], {
          published: true,
          unpublished_changes: false,
        }),
      ],
    });

    expect(outcome.writes[0]?.publish).toBe(false);
  });

  it("should leave a story the run published as a draft once an editor changed its draft", () => {
    const outcome = undoStories({
      inverse: [entry(1, [renameBack], true)],
      stories: [
        home([{ _uid: "a", component: "card", headline: "Hi" }], {
          published: true,
          unpublished_changes: true,
        }),
      ],
    });

    expect(outcome.writes[0]?.publish).toBe(false);
    expect(outcome.notRepublished).toEqual(["home"]);
  });
});
