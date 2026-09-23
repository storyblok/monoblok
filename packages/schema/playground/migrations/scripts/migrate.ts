/**
 * Runs the playground's migrations against a content store.
 *
 * The store is the only thing the two paths disagree about: `--offline` reads
 * and writes the committed fixtures, the default reads and writes the space.
 * Everything below the store — which stories a migration touches, what it
 * refuses, what it records to undo — is one code path, so an offline run is
 * evidence about a live one.
 *
 * Usage:
 *   pnpm migrate:offline                     every migration, against fixtures/
 *   pnpm migrate:offline --migration 0003-…  one migration
 *   pnpm migrate:offline --undo <run-id>     replay a recorded run's inverse
 *   pnpm migrate --confirm-writes            the same, against the space
 */
import "dotenv/config";

import { readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import {
  applyPatches,
  blockComponents,
  type CompiledMigration,
  localJournal,
  runMigrationOnStory,
  runId,
  type StoryInverse,
} from "@storyblok/schema/migrations";
import {
  type ContentStore,
  fileContentStore,
  type PlaygroundStory,
  spaceContentStore,
} from "../src/content-store";

const PACKAGE_ROOT = path.resolve(import.meta.dirname, "..");
const FIXTURES_DIR = path.join(PACKAGE_ROOT, "fixtures");
const MIGRATIONS_DIR = path.join(PACKAGE_ROOT, "migrations");
const OFFLINE_JOURNAL_DIR = path.join(FIXTURES_DIR, ".journal");
const LIVE_JOURNAL_DIR = path.join(PACKAGE_ROOT, ".storyblok", "migrations");

/** The space a run is recorded against when it ran against the fixtures. */
const OFFLINE_SPACE = "fixtures";

/** Admits no dots, so a `*.before.ts` schema snapshot beside a migration is left alone. */
const MIGRATION_FILE = /^(\d+-[a-z0-9-]+)\.(?:ts|js|mjs)$/;

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? undefined : args[at + 1];
};

const offline = args.includes("--offline");
const confirmWrites = args.includes("--confirm-writes");
const only = flag("migration");
const undo = flag("undo");

type LoadedMigration = { id: string; migration: CompiledMigration };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCompiledMigration(value: unknown): value is CompiledMigration {
  return isRecord(value) && Array.isArray(value.ops) && Array.isArray(value.targets);
}

async function loadMigrations(): Promise<LoadedMigration[]> {
  const files = await readdir(MIGRATIONS_DIR).catch((): string[] => []);
  const candidates = files
    .flatMap((file) => {
      const match = MIGRATION_FILE.exec(file);
      return match?.[1] ? [{ file, id: match[1] }] : [];
    })
    .sort((a, b) => a.file.localeCompare(b.file));

  return Promise.all(
    candidates.map(async ({ file, id }) => {
      const module = await import(pathToFileURL(path.join(MIGRATIONS_DIR, file)).href);
      const migration: unknown = module.default;
      if (!isCompiledMigration(migration)) {
        throw new Error(`${file} does not default-export a migration.`);
      }
      return { id, migration };
    }),
  );
}

type PlannedWrite = { story: PlaygroundStory; content: Record<string, unknown> };

type MigrationPlan = {
  writes: PlannedWrite[];
  inverse: StoryInverse[];
  refusals: { slug: string; reason: string }[];
};

/**
 * Decides what the run would write, without writing anything. Same separation
 * as the CLI's apply: there is no dry-run branch, so what a run reports and what
 * it does cannot drift.
 */
function planMigration(migration: CompiledMigration, stories: PlaygroundStory[]): MigrationPlan {
  const plan: MigrationPlan = { writes: [], inverse: [], refusals: [] };

  for (const story of stories) {
    const result = runMigrationOnStory(migration, story.content);
    if (!result.changed) {
      continue;
    }

    // Content that arrived with repeated ids sends the author to the story, not
    // to the migration — but both are refused, because the backend renumbers
    // them on write and that strands the record needed to undo the run.
    if (result.unstableUids.preExisting.length > 0) {
      plan.refusals.push({
        slug: story.slug,
        reason: `already contains repeated block ids: ${result.unstableUids.preExisting.join(", ")}`,
      });
      continue;
    }
    if (result.unstableUids.duplicate.length > 0 || result.unstableUids.missing > 0) {
      plan.refusals.push({
        slug: story.slug,
        reason:
          result.unstableUids.duplicate.length > 0
            ? `the migration left repeated block ids: ${result.unstableUids.duplicate.join(", ")}`
            : `the migration left ${result.unstableUids.missing} block(s) without an id`,
      });
      continue;
    }
    if (result.nonIdempotent.length > 0) {
      plan.refusals.push({
        slug: story.slug,
        reason: `op ${result.nonIdempotent.map((entry) => entry.op).join(", ")} disagrees with itself on a second pass`,
      });
      continue;
    }
    if (!isRecord(result.content)) {
      continue;
    }

    plan.inverse.push({ story: String(story.id), patches: result.inverse });
    plan.writes.push({ story, content: result.content });
  }

  return plan;
}

/**
 * The runner filters ops by the block it is visiting, not by the migration's
 * targets, so a caller that wants to skip stories has to read `targets` itself.
 */
function touchesAnyTarget(content: unknown, targets: readonly string[]): boolean {
  const components = new Set(blockComponents(content));
  return targets.some((target) => components.has(target));
}

async function runMigrations(store: ContentStore, space: string): Promise<number> {
  const loaded = await loadMigrations();
  const selected = only ? loaded.filter((entry) => entry.id === only) : loaded;
  if (selected.length === 0) {
    console.error(only ? `No migration "${only}" in ${MIGRATIONS_DIR}.` : `No migrations found.`);
    return 2;
  }

  const journal = localJournal(offline ? OFFLINE_JOURNAL_DIR : LIVE_JOURNAL_DIR);

  for (const { id, migration } of selected) {
    const stories = (await store.list()).filter((story) =>
      touchesAnyTarget(story.content, migration.targets),
    );
    const plan = planMigration(migration, stories);

    for (const refusal of plan.refusals) {
      console.warn(`${id}: refused ${refusal.slug} — ${refusal.reason}`);
    }

    const written: StoryInverse[] = [];
    const inverseByStory = new Map(plan.inverse.map((entry) => [entry.story, entry]));
    for (const write of plan.writes) {
      await store.put({ ...write.story, content: write.content });
      const recorded = inverseByStory.get(String(write.story.id));
      if (recorded) {
        written.push(recorded);
      }
      console.info(`${id}: migrated ${write.story.slug}`);
    }

    const record = runId(id);
    await journal.record(
      {
        id: record,
        space,
        migration: id,
        title: migration.title,
        appliedAt: new Date().toISOString(),
        stories: written.length,
        blocks: written.reduce((total, entry) => total + entry.patches.length, 0),
      },
      written,
    );
    console.info(`${id}: recorded run ${record} (${written.length} stories)`);
  }

  return 0;
}

async function undoRun(store: ContentStore, space: string, id: string): Promise<number> {
  const journal = localJournal(offline ? OFFLINE_JOURNAL_DIR : LIVE_JOURNAL_DIR);
  const run = await journal.read(id);
  if (!run) {
    console.error(`No recorded run "${id}".`);
    return 2;
  }
  if (run.space !== space) {
    console.error(`Run "${id}" was recorded against space ${run.space}, not ${space}.`);
    return 2;
  }

  let failed = 0;
  for (const { story: storyId, patches } of await journal.readInverse(id)) {
    const story = await store.get(Number(storyId));
    const content = structuredClone(story.content);
    const applied = applyPatches(content, patches);
    if (applied.conflicts.length > 0 || applied.missing.length > 0) {
      // A block whose live content moved on is skipped whole rather than
      // clobbered, so the story is left as it is rather than half-undone.
      console.warn(
        `undo ${id}: ${story.slug} — ${applied.conflicts.length} conflict(s), ${applied.missing.length} missing block(s); not written`,
      );
      failed++;
      continue;
    }
    await store.put({ ...story, content });
    console.info(`undo ${id}: restored ${story.slug} (${applied.applied} changes)`);
  }

  return failed > 0 ? 1 : 0;
}

async function main(): Promise<number> {
  if (offline) {
    const store = fileContentStore(FIXTURES_DIR);
    return undo ? undoRun(store, OFFLINE_SPACE, undo) : runMigrations(store, OFFLINE_SPACE);
  }

  if (!confirmWrites) {
    console.error("Refusing to run: this writes to the space. Pass --confirm-writes or --offline.");
    return 2;
  }

  const token = process.env.STORYBLOK_TOKEN;
  const space = process.env.STORYBLOK_SPACE_ID;
  if (!token || !space) {
    console.error("Missing required env vars: STORYBLOK_TOKEN, STORYBLOK_SPACE_ID");
    return 2;
  }

  const store = spaceContentStore({ space, token });
  return undo ? undoRun(store, space, undo) : runMigrations(store, space);
}

process.exit(await main());
