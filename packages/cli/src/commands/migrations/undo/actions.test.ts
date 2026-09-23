import { describe, expect, it, vi } from "vitest";
import type { Journal, MigrationRun, StoryInverse } from "@storyblok/schema/migrations";
import { undoRun } from "./actions";

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

describe("undoRun", () => {
  it("should replay the recorded inverse against current content", async () => {
    const journal = journalHolding([run], {
      "run-1": [
        {
          story: "1",
          patches: [
            {
              uid: "a",
              component: "card",
              ops: [
                { kind: "set", key: "title", value: "Hi" },
                { kind: "unset", key: "headline", expect: "Hi" },
              ],
            },
          ],
        },
      ],
    });

    const outcome = await undoRun({
      journal,
      id: "run-1",
      fetchStory: async () => ({
        id: 1,
        slug: "home",
        content: {
          _uid: "r",
          component: "page",
          body: [{ _uid: "a", component: "card", headline: "Hi" }],
        },
      }),
    });

    expect(outcome.conflicts).toEqual([]);
    expect(outcome.writes).toEqual([
      expect.objectContaining({
        content: expect.objectContaining({
          body: [{ _uid: "a", component: "card", title: "Hi" }],
        }),
      }),
    ]);
  });

  it("should leave the story it read untouched, so a failed write cannot half-apply", async () => {
    const live = {
      _uid: "r",
      component: "page",
      body: [{ _uid: "a", component: "card", headline: "Hi" }],
    };
    const journal = journalHolding([run], {
      "run-1": [
        {
          story: "1",
          patches: [
            {
              uid: "a",
              component: "card",
              ops: [
                { kind: "set", key: "title", value: "Hi" },
                { kind: "unset", key: "headline", expect: "Hi" },
              ],
            },
          ],
        },
      ],
    });

    await undoRun({
      journal,
      id: "run-1",
      fetchStory: async () => ({ id: 1, slug: "home", content: live }),
    });

    expect(live.body).toEqual([{ _uid: "a", component: "card", headline: "Hi" }]);
  });

  it("should throw for a run id the journal does not hold", async () => {
    const journal = journalHolding([run], {});

    await expect(
      undoRun({
        journal,
        id: "no-such-run",
        fetchStory: async () => ({ id: 1, slug: "home", content: {} }),
      }),
    ).rejects.toThrow(/no-such-run/);
  });

  it("should report blocks whose current value no longer matches what was recorded", async () => {
    const journal = journalHolding([run], {
      "run-1": [
        {
          story: "1",
          patches: [
            {
              uid: "a",
              component: "card",
              ops: [{ kind: "set", key: "title", value: "Hi", expect: "Hi" }],
            },
          ],
        },
      ],
    });

    const outcome = await undoRun({
      journal,
      id: "run-1",
      fetchStory: async () => ({
        id: 1,
        slug: "home",
        content: {
          _uid: "r",
          component: "page",
          body: [{ _uid: "a", component: "card", title: "edited since" }],
        },
      }),
    });

    expect(outcome.conflicts).toEqual([{ slug: "home", count: 1 }]);
  });

  it("should replay every story the run recorded", async () => {
    const patchesFor = (uid: string): StoryInverse["patches"] => [
      { uid, component: "card", ops: [{ kind: "set", key: "title", value: "Hi" }] },
    ];
    const journal = journalHolding([run], {
      "run-1": [
        { story: "1", patches: patchesFor("a") },
        { story: "2", patches: patchesFor("b") },
      ],
    });

    const outcome = await undoRun({
      journal,
      id: "run-1",
      fetchStory: async (id) => ({
        id,
        slug: `story-${id}`,
        content: {
          _uid: "r",
          component: "page",
          body: [{ _uid: id === 1 ? "a" : "b", component: "card" }],
        },
      }),
    });

    expect(outcome.writes.map((write) => write.story.slug)).toEqual(["story-1", "story-2"]);
  });
});
