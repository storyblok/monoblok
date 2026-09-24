/**
 * Every migration in the catalogue, against the committed fixtures, with no
 * token and no network.
 *
 * The assertions are the same five questions for every row: does it do
 * anything, does it leave the block ids alone, can it be run twice, does the
 * inverse the run recorded put the content back, and — where one can be derived
 * from the ops alone — does the derived inverse land in the same place. A case
 * the op set cannot express is then a row that cannot be added, rather than a
 * discovery someone makes in production.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  applyPatches,
  deriveInverse,
  diffBlock,
  indexBlocks,
  runMigrationOnStory,
} from "@storyblok/schema/migrations";
import { describe, expect, it } from "vitest";

import { migrations } from "../migrations";
import { fileContentStore } from "../src/content-store";
import { mockS3Journal } from "../src/journal-mock-s3";
import { planMigration } from "../src/plan-migration";

const FIXTURES_DIR = path.resolve(import.meta.dirname, "../fixtures");
const EXPECTED_DIR = path.resolve(import.meta.dirname, "expected");

const store = fileContentStore(FIXTURES_DIR);

/** The one row that must match nothing; every other row that matches nothing is a bug. */
const NO_MATCH_MIGRATION = "0019-no-matches";

/**
 * The rows a second pass keeps moving. Both are reported and refused; they are
 * held apart below, one test each, because they are not the same kind of
 * problem. 0018 is an authoring mistake, and 0017 is an op that does not settle
 * on this space's content however carefully it was written.
 */
const NOT_REPEATABLE = new Set(["0017-unwrap-page-sections", "0018-toggles"]);

/**
 * `pnpm test -- -u` is not enough: these files are the migrated content itself,
 * so they are rewritten only when asked for by name.
 */
const UPDATING_EXPECTED = process.env.UPDATE_EXPECTED === "1";

/** What one migration leaves behind, keyed by story slug, for the stories it changed. */
async function migratedContent(id: string): Promise<Record<string, unknown>> {
  const migration = migrations[id]!;
  const changed: Record<string, unknown> = {};
  for (const story of await store.list()) {
    const result = runMigrationOnStory(migration, story.content);
    if (result.changed) {
      changed[story.slug] = result.content;
    }
  }
  return changed;
}

async function readExpected(id: string): Promise<unknown> {
  return JSON.parse(await readFile(path.join(EXPECTED_DIR, `${id}.json`), "utf8"));
}

describe.each(Object.keys(migrations))("%s", (id) => {
  const migration = migrations[id]!;

  it("should change at least one story", async () => {
    const stories = await store.list();
    const changed = stories.filter(
      (story) => runMigrationOnStory(migration, story.content).changed,
    );

    if (id === NO_MATCH_MIGRATION) {
      expect(changed).toHaveLength(0);
      return;
    }
    expect(changed.length).toBeGreaterThan(0);
  });

  it("should leave every block with a stable id", async () => {
    for (const story of await store.list()) {
      const result = runMigrationOnStory(migration, story.content);
      expect(result.unstableUids, story.slug).toEqual({
        duplicate: [],
        missing: 0,
        preExisting: [],
      });
    }
  });

  it("should apply a second time without moving anything", async () => {
    if (NOT_REPEATABLE.has(id)) {
      return;
    }

    for (const story of await store.list()) {
      const once = runMigrationOnStory(migration, story.content);
      if (!once.changed) {
        continue;
      }

      expect(runMigrationOnStory(migration, once.content).changed, story.slug).toBe(false);
      expect(once.nonIdempotent, story.slug).toEqual([]);
    }
  });

  it("should round-trip through the inverse its run recorded", async () => {
    for (const story of await store.list()) {
      const result = runMigrationOnStory(migration, story.content);
      if (!result.changed) {
        continue;
      }

      const restored = structuredClone(result.content);
      const applied = applyPatches(restored, result.inverse);

      expect(applied.conflicts, story.slug).toEqual([]);
      expect(applied.missing, story.slug).toEqual([]);
      expect(restored, story.slug).toEqual(story.content);
    }
  });

  it("should restore every block it changed through the inverse derived from its ops", async () => {
    const derived = deriveInverse(migration.ops);
    if (!derived.derivable || derived.lossy.length > 0) {
      return;
    }

    // `targets` comes from the derived inverse, not from the forward migration:
    // a `renameBlock` inverse addresses the name the rename produced.
    const inverse = { ops: derived.ops, targets: derived.targets };
    for (const story of await store.list()) {
      const forward = runMigrationOnStory(migration, story.content);
      if (!forward.changed) {
        continue;
      }

      const before = indexBlocks(story.content);
      const restored = indexBlocks(runMigrationOnStory(inverse, forward.content).content);
      for (const patch of forward.patches) {
        const original = before.get(patch.uid)!;
        const back = restored.get(patch.uid);
        expect(back, `${story.slug}/${patch.uid}`).toBeDefined();
        // A null diff is the assertion: `diffBlock` compares the part of a
        // block a patch may own, so a nested block's own changes do not read as
        // its parent's.
        expect(diffBlock(original, back!), `${story.slug}/${patch.uid}`).toBeNull();
      }
    }
  });

  it("should leave the content its expected snapshot records", async () => {
    const migrated = await migratedContent(id);

    if (UPDATING_EXPECTED) {
      await writeFile(
        path.join(EXPECTED_DIR, `${id}.json`),
        `${JSON.stringify(migrated, null, 2)}\n`,
      );
    }

    expect(migrated).toEqual(await readExpected(id));
  });
});

describe("a row a second pass keeps moving", () => {
  it("should report a toggling block before anything is written", async () => {
    const migration = migrations["0018-toggles"]!;
    const story = (await store.list()).find((candidate) => candidate.slug === "home")!;

    const once = runMigrationOnStory(migration, story.content);

    expect(once.nonIdempotent).not.toEqual([]);
    expect(runMigrationOnStory(migration, once.content).changed).toBe(true);
    expect(planMigration(migration, [story]).refusals.map((refusal) => refusal.blame)).toEqual([
      "migration",
    ]);
  });

  it("should refuse an unwrap that keeps finding another container below the one it dissolved", async () => {
    const migration = migrations["0017-unwrap-page-sections"]!;
    // `home` nests a section inside a section, so dissolving the outer one
    // lifts the inner one into the field the op reads, where a second run
    // dissolves that too. No callback is involved: the op does not settle on
    // this content, which is the case a structural op can fail on and an
    // `alter` op cannot be blamed for.
    const story = (await store.list()).find((candidate) => candidate.slug === "home")!;

    const once = runMigrationOnStory(migration, story.content);

    expect(runMigrationOnStory(migration, once.content).changed).toBe(true);
    // The page is what the op is applied to, so the page is what is reported.
    expect(once.nonIdempotent).toEqual([{ uid: "11111111-0000-4000-8000-000000000001", op: 0 }]);
    expect(planMigration(migration, [story]).refusals.map((refusal) => refusal.blame)).toEqual([
      "migration",
    ]);
  });
});

describe("an inverse derived from the ops alone", () => {
  /** Blocks the derived inverse did not leave as it found them, excluding those the run changed. */
  async function untouchedBlocksDisturbedBy(id: string): Promise<string[]> {
    const migration = migrations[id]!;
    const derived = deriveInverse(migration.ops);
    if (!derived.derivable || derived.lossy.length > 0) {
      return [];
    }

    const disturbed: string[] = [];
    for (const story of await store.list()) {
      const forward = runMigrationOnStory(migration, story.content);
      if (!forward.changed) {
        continue;
      }
      const changedUids = new Set(forward.patches.map((patch) => patch.uid));
      const restored = indexBlocks(
        runMigrationOnStory({ ops: derived.ops, targets: derived.targets }, forward.content)
          .content,
      );
      for (const [uid, original] of indexBlocks(story.content)) {
        const back = restored.get(uid);
        if (!changedUids.has(uid) && (!back || diffBlock(original, back))) {
          disturbed.push(`${story.slug}/${original.component}`);
        }
      }
    }
    return disturbed;
  }

  it("should name the rows whose derived inverse reaches blocks the run never changed", async () => {
    const reaching: string[] = [];
    for (const id of Object.keys(migrations)) {
      if ((await untouchedBlocksDisturbedBy(id)).length > 0) {
        reaching.push(id);
      }
    }

    // A derived inverse is blind by construction: it knows which key the
    // migration moved, never which blocks were holding it. So its mirror op
    // sweeps up every instance that carries the name now, including the ones
    // that always did — a card that was born with a headline is renamed back to
    // a title it never had. This is why the patches a run records take
    // precedence whenever they exist, and it is pinned rather than asserted
    // away so that a row joining this list is a decision and not an accident.
    expect(reaching).toEqual([
      "0001-rename-card-title",
      "0007-add-card-slug",
      "0010-rename-teaser-block",
    ]);
  });
});

describe("the catalogue as a whole", () => {
  it("should name the story each migration changes, so no row is vacuous", async () => {
    const stories = await store.list();
    const touched = Object.fromEntries(
      Object.entries(migrations).map(([id, migration]) => [
        id,
        stories
          .filter((story) => runMigrationOnStory(migration, story.content).changed)
          // Sorted by name rather than left in store order, which is story id
          // order and therefore says something about the space rather than
          // about the migration.
          .map((story) => story.slug)
          .sort(),
      ]),
    );

    // Pinned as a whole rather than counted: a row that stops biting the story
    // it was written for is a row whose fixture moved out from under it, even
    // when some other story keeps it non-empty.
    expect(touched).toEqual({
      "0001-rename-card-title": ["legacy"],
      "0002-rename-nested-author-bio": ["home", "legacy", "team"],
      "0003-split-author-name": ["legacy"],
      "0004-merge-author-name": ["home", "team"],
      "0005-coerce-card-price": ["legacy"],
      "0006-remove-card-subtitle": ["legacy"],
      "0007-add-card-slug": ["legacy"],
      "0008-pin-page-opener": ["home", "legacy", "team"],
      "0009-scope-slug-under-card": ["legacy"],
      "0010-rename-teaser-block": ["home", "legacy", "team"],
      "0011-single-asset-to-list": ["home", "legacy", "team"],
      "0012-rewrite-richtext-links": ["legacy"],
      "0013-story-link-to-url": ["home", "legacy"],
      "0014-translate-card-headline": ["legacy"],
      "0015-rename-category-values": ["pricing", "translated"],
      "0016-wrap-page-body": ["home", "legacy", "pricing", "team", "translated"],
      "0017-unwrap-page-sections": ["home", "legacy", "team", "translated"],
      "0018-toggles": ["home"],
      "0019-no-matches": [],
      "0020-pricing-table-column": ["pricing"],
    });
  });

  it("should address a renamed block by the derived inverse's own targets", () => {
    const migration = migrations["0010-rename-teaser-block"]!;
    const derived = deriveInverse(migration.ops);

    // The forward migration's targets would skip every story the inverse has to
    // visit, because the blocks it addresses no longer carry the old name.
    expect(migration.targets).toEqual(["teaser"]);
    expect(derived.targets).toEqual(["card"]);
  });
});

describe("a run recorded through a journal that writes nothing to disk", () => {
  it("should undo the run from what the journal handed back", async () => {
    const journal = mockS3Journal("storyblok-migrations", () => {});
    const migration = migrations["0001-rename-card-title"]!;
    const story = (await store.list()).find((candidate) => candidate.slug === "legacy")!;
    const result = runMigrationOnStory(migration, story.content);

    await journal.record(
      {
        id: "run-1",
        space: "fixtures",
        migration: "0001-rename-card-title",
        appliedAt: new Date().toISOString(),
        stories: 1,
        blocks: result.inverse.length,
      },
      [{ story: String(story.id), patches: result.inverse }],
    );

    const [recorded] = await journal.readInverse("run-1");
    const restored = structuredClone(result.content);
    applyPatches(restored, recorded!.patches);

    expect(restored).toEqual(story.content);
  });

  it("should not hand back the inverse of a run it never recorded", async () => {
    const journal = mockS3Journal("storyblok-migrations", () => {});

    expect(await journal.readInverse("run-nobody-wrote")).toEqual([]);
    expect(await journal.read("run-nobody-wrote")).toBeUndefined();
  });
});
