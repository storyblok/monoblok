import { describe, expect, it, vi } from "vitest";
import { applyMigration, type StoryForMigration } from "./apply-migration";
import { defineMigration } from "./define-migration";
import type { Journal, MigrationRun, StoryInverse } from "./journal";
import { alterField, expandBlock, renameField, unwrapChildren, wrapChildren } from "./ops";
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

describe("undoStories publish state", () => {
  it("should report a story the run published for the first time instead of republishing it", () => {
    const outcome = undoStories({
      inverse: [
        {
          story: 1,
          patches: [renameBack],
          before: { published: false, unpublishedChanges: false },
          publishedByRun: true,
        },
      ],
      stories: [
        home([{ _uid: "a", component: "card", headline: "Hi" }], {
          published: true,
          unpublished_changes: false,
        }),
      ],
    });

    expect(outcome.writes[0]?.publish).toBe(false);
    expect(outcome.firstPublishedByRun).toEqual(["home"]);
  });

  it("should not republish a story unpublished since the run", () => {
    const outcome = undoStories({
      inverse: [entry(1, [renameBack], true)],
      stories: [
        home([{ _uid: "a", component: "card", headline: "Hi" }], {
          published: false,
          unpublished_changes: false,
        }),
      ],
    });

    expect(outcome.writes[0]?.publish).toBe(false);
    expect(outcome.notRepublished).toEqual(["home"]);
  });

  it("should not republish a story whose publish state was not passed in", () => {
    const outcome = undoStories({
      inverse: [entry(1, [renameBack], true)],
      stories: [home([{ _uid: "a", component: "card", headline: "Hi" }])],
    });

    expect(outcome.writes[0]?.publish).toBe(false);
    expect(outcome.notRepublished).toEqual(["home"]);
  });
});

describe("undoStories after a recorded run", () => {
  type Content = { _uid: string; component: string; [key: string]: unknown };

  function migrate(ops: Parameters<typeof defineMigration>[0], content: Content) {
    const outcome = applyMigration({
      migration: defineMigration(ops),
      id: "0001-x",
      space: "1",
      stories: [{ id: 1, slug: "home", content }],
    });
    expect(outcome.refusals).toEqual([]);
    return { inverse: outcome.inverse, content: outcome.writes[0].content as Content };
  }

  function undo(inverse: StoryInverse[], content: unknown, force = false) {
    return undoStories({ inverse, stories: [{ id: 1, slug: "home", content }], force });
  }

  const uids = (list: unknown) => (list as { _uid: string }[]).map((item) => item._uid);

  it("should put expanded blocks back in their original order", () => {
    const original: Content = {
      _uid: "r",
      component: "page",
      body: [
        { _uid: "a", component: "pair" },
        { _uid: "d", component: "text" },
        { _uid: "e", component: "pair" },
      ],
    };
    const run = migrate(
      [
        expandBlock({ block: "pair" }, (pair) => [
          { _uid: `${pair._uid}1`, component: "text" },
          { _uid: `${pair._uid}2`, component: "text" },
        ]),
      ],
      structuredClone(original),
    );
    expect(uids(run.content.body)).toEqual(["a1", "a2", "d", "e1", "e2"]);

    const outcome = undo(run.inverse, run.content);

    expect(outcome.conflicts).toEqual([]);
    expect(outcome.writes[0].content).toEqual(original);
  });

  it("should put unwrapped containers back in their original order", () => {
    const original: Content = {
      _uid: "r",
      component: "page",
      body: [
        { _uid: "w1", component: "grid", items: [{ _uid: "x", component: "card" }] },
        { _uid: "d", component: "text" },
        { _uid: "w2", component: "grid", items: [{ _uid: "y", component: "card" }] },
      ],
    };
    const run = migrate(
      [unwrapChildren({ block: "page", field: "body", unwrap: "grid", from: "items" })],
      structuredClone(original),
    );

    const outcome = undo(run.inverse, run.content);

    expect(outcome.writes[0].content).toEqual(original);
  });

  describe("an edit made after a structural op", () => {
    const original: Content = {
      _uid: "r",
      component: "page",
      body: [{ _uid: "c", component: "card", title: "A" }],
      aside: [],
    };
    const wrap = [wrapChildren({ block: "page", field: "body", in: "grid", into: "items" })];

    function wrapped() {
      const run = migrate(wrap, structuredClone(original));
      const grid = (run.content.body as Content[])[0];
      return { ...run, grid, child: (grid.items as Content[])[0] };
    }

    it("should report an edited child as a conflict and keep the edit", () => {
      const run = wrapped();
      run.child.title = "Edited";

      const outcome = undo(run.inverse, run.content);

      expect(outcome.conflicts).toEqual([{ slug: "home", count: 1 }]);
      expect(outcome.writes).toEqual([]);
    });

    it("should report a block added inside the wrapper as a conflict", () => {
      const run = wrapped();
      (run.grid.items as Content[]).push({ _uid: "new", component: "card" });

      expect(undo(run.inverse, run.content).conflicts).toEqual([{ slug: "home", count: 1 }]);
    });

    it("should never repeat a uid, even under force, when a child moved elsewhere", () => {
      const run = wrapped();
      run.grid.items = [];
      run.content.aside = [run.child];

      const outcome = undo(run.inverse, run.content, true);

      expect(outcome.conflicts).toEqual([{ slug: "home", count: 1 }]);
      expect(outcome.writes).toEqual([]);
    });
  });

  it("should report an edit to a block inside a renamed field", () => {
    const run = migrate([renameField({ block: "page", field: "body", to: "content" })], {
      _uid: "r",
      component: "page",
      body: [{ _uid: "c", component: "card", title: "Old" }],
    });
    (run.content.content as Content[])[0].title = "Edited";

    const outcome = undo(run.inverse, run.content);

    expect(outcome.conflicts).toEqual([{ slug: "home", count: 1 }]);
    expect(outcome.writes).toEqual([]);
  });

  it("should restore a value an op turned into a block list", () => {
    const original: Content = { _uid: "r", component: "page", media: "https://x" };
    const run = migrate(
      [
        alterField({ block: "page", field: "media" }, (value) =>
          typeof value === "string" ? [{ _uid: "img", component: "image", src: value }] : value,
        ),
      ],
      structuredClone(original),
    );

    expect(undo(run.inverse, run.content).writes[0].content).toEqual(original);
  });

  it("should treat a second undo of the same run as already done", () => {
    const run = migrate([renameField({ block: "card", field: "title", to: "headline" })], {
      _uid: "r",
      component: "page",
      body: [{ _uid: "c", component: "card", title: "T" }],
    });
    const first = undo(run.inverse, run.content);

    const second = undo(run.inverse, first.writes[0].content);

    expect(second.conflicts).toEqual([]);
    expect(second.writes).toEqual([]);
  });
});
