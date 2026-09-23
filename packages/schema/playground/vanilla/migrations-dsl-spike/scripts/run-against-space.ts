/**
 * SPIKE — end-to-end probe against a real Storyblok space.
 *
 * Writes to the space, so it refuses to do anything without `--confirm-writes`.
 *
 * Seed first:
 *   bash .agents/skills/qa-engineer-manual/scripts/seed-scenario.sh \
 *     --scenario has-spike-dsl-content \
 *     --scenario-dir packages/schema/playground/vanilla/migrations-dsl-spike/scenarios
 *
 * Then, from the spike directory:
 *   set -a && source ../../../../../.env.qa-engineer-manual && set +a
 *   <tsx> scripts/run-against-space.ts --confirm-writes --phase roundtrip
 *
 * Phases:
 *   roundtrip  every probe migration, applied and rolled back immediately;
 *              checks uid stability and read-back fidelity at each step
 *   migrate    apply one migration and record the run in the journal, so a human
 *              can edit the story in the Storyblok UI before the rollback runs
 *   rollback   replay a recorded run's inverse against whatever the story now
 *              holds; takes `--run <id>`, or defaults to the latest run
 *
 * `SPIKE_JOURNAL=mock-s3` swaps the storage backend. Rollback still works, which
 * is the point: it reads through the interface rather than off a known path.
 */
import process from "node:process";
import { applyPatches, indexBlocks } from "../src/patch";
import { runMigrationOnStory } from "../src/runner";
import * as migrations from "../migrations";
import type { CompiledMigration } from "../src/define-migration";
import type { Journal, StoryInverse } from "../src/journal";
import { localJournal, runId } from "../src/journal-local";
import { mockS3Journal } from "../src/journal-mock-s3";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? undefined : args[at + 1];
};

const TOKEN = process.env.STORYBLOK_TOKEN;
const SPACE = process.env.STORYBLOK_SPACE_ID;
const BASE = "https://mapi.storyblok.com/v1";
const PHASE = flag("phase") ?? "roundtrip";

// Swapping this is the whole demonstration. Note that `mock-s3` keeps its
// records in memory, so it cannot carry one across the `migrate` and `rollback`
// phases, which are separate processes — use it against `roundtrip`.
const journal: Journal =
  process.env.SPIKE_JOURNAL === "mock-s3" ? mockS3Journal("storyblok-migrations") : localJournal();

if (!args.includes("--confirm-writes")) {
  console.error("Refusing to run: this script writes to the space. Pass --confirm-writes.");
  process.exit(2);
}
if (!TOKEN || !SPACE) {
  console.error("Missing STORYBLOK_TOKEN / STORYBLOK_SPACE_ID.");
  process.exit(2);
}

type Json = Record<string, unknown>;

async function mapi(path: string, init: RequestInit = {}): Promise<any> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: TOKEN!, "Content-Type": "application/json", ...init.headers },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} -> ${response.status} ${text.slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : null;
}

const listStories = async () => (await mapi(`/spaces/${SPACE}/stories`)).stories;
const getStory = async (id: number) => (await mapi(`/spaces/${SPACE}/stories/${id}`)).story;
const putStory = (story: Json, content: unknown) =>
  mapi(`/spaces/${SPACE}/stories/${story.id}`, {
    method: "PUT",
    body: JSON.stringify({ story: { ...story, content }, force_update: "1" }),
  });

/** Key order is not part of the content, so compare with keys sorted. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Json)
        .sort()
        .map((key) => [key, canonical((value as Json)[key])]),
    );
  }
  return value;
}

const uidsOf = (content: unknown) => [...indexBlocks(content).keys()].sort();

const results: { outcome: string; function: string; details: string }[] = [];
function record(fn: string, outcome: "PASS" | "FAIL", details: string) {
  results.push({ outcome, function: fn, details });
  console.log(JSON.stringify({ outcome, function: fn, details }));
}

/**
 * Writes `content` and compares the read-back story against what was sent.
 * Anything that differs is a key the server added, dropped or rewrote, and
 * would surface later as a spurious rollback conflict.
 */
async function writeAndVerify(story: Json, content: unknown, label: string) {
  const sentUids = uidsOf(content);
  await putStory(story, content);
  const readBack = await getStory(story.id as number);

  const sent = JSON.stringify(canonical(content));
  const got = JSON.stringify(canonical(readBack.content));
  if (sent !== got) {
    record(`${label}:read-back-fidelity`, "FAIL", firstDifference(sent, got));
  } else {
    record(`${label}:read-back-fidelity`, "PASS", "read-back content equals what was sent");
  }

  const gotUids = uidsOf(readBack.content);
  const stable = JSON.stringify(sentUids) === JSON.stringify(gotUids);
  record(
    `${label}:uid-stability`,
    stable ? "PASS" : "FAIL",
    stable
      ? `${gotUids.length} block uids survived the update unchanged`
      : `sent ${JSON.stringify(sentUids)}, got ${JSON.stringify(gotUids)}`,
  );

  return readBack;
}

function firstDifference(a: string, b: string): string {
  let at = 0;
  while (at < a.length && at < b.length && a[at] === b[at]) at++;
  return `diverges at ${at}: sent ...${a.slice(at, at + 160)} / got ...${b.slice(at, at + 160)}`;
}

const probes = Object.entries(migrations) as [string, CompiledMigration][];

if (PHASE === "roundtrip") {
  for (const [name, migration] of probes) {
    for (const summary of await listStories()) {
      const story = await getStory(summary.id);
      const original = structuredClone(story.content);
      const run = runMigrationOnStory(migration, story.content);
      if (!run.changed) {
        record(`${name}:${story.slug}`, "PASS", "no matching blocks, story untouched");
        continue;
      }
      if (run.unstableUids.duplicate.length > 0 || run.unstableUids.missing > 0) {
        record(
          `${name}:${story.slug}:block-identity`,
          "FAIL",
          `migration left uids the backend would regenerate: ${JSON.stringify(run.unstableUids)}`,
        );
        continue;
      }
      if (run.nonIdempotent.length > 0) {
        record(
          `${name}:${story.slug}:idempotency`,
          "PASS",
          `alter ops that disagree with themselves on a rerun, refused before the write: ${JSON.stringify(run.nonIdempotent)}`,
        );
        continue;
      }

      await writeAndVerify(story, run.content, `${name}:${story.slug}`);

      // Rollback immediately, from live content rather than from a snapshot.
      const live = await getStory(story.id);
      const content = structuredClone(live.content);
      const applied = applyPatches(content, run.inverse);
      const restored = await writeAndVerify(live, content, `${name}:${story.slug}:rollback`);

      const exact =
        JSON.stringify(canonical(restored.content)) === JSON.stringify(canonical(original));
      record(
        `${name}:${story.slug}:rollback-exact`,
        exact && applied.conflicts.length === 0 ? "PASS" : "FAIL",
        `conflicts=${applied.conflicts.length} missing=${applied.missing.length} identical-to-original=${exact}`,
      );
    }
  }
} else if (PHASE === "migrate") {
  const which = flag("migration") ?? "renameNestedField";
  const migration = (migrations as Record<string, CompiledMigration>)[which];
  if (!migration) throw new Error(`No migration "${which}"`);
  const inverse: StoryInverse[] = [];
  for (const summary of await listStories()) {
    const story = await getStory(summary.id);
    const run = runMigrationOnStory(migration, story.content);
    if (!run.changed) continue;
    await writeAndVerify(story, run.content, `${which}:${story.slug}`);
    inverse.push({ story: String(story.id), patches: run.inverse });
  }

  const id = runId(migration.name ?? which);
  await journal.record(
    {
      id,
      space: SPACE!,
      migration: migration.name ?? which,
      title: migration.title,
      appliedAt: new Date().toISOString(),
      stories: inverse.length,
      blocks: inverse.reduce((total, entry) => total + entry.patches.length, 0),
    },
    inverse,
  );
  record("migrate", "PASS", `recorded run ${id} covering ${inverse.length} stories`);
} else if (PHASE === "rollback") {
  const runs = await journal.list(SPACE!);
  const id = flag("run") ?? runs.at(-1)?.id;
  if (!id) throw new Error("No recorded run to roll back. Run the migrate phase first.");
  record("rollback:selected", "PASS", `rolling back ${id}`);

  for (const { story: storyId, patches } of await journal.readInverse(id)) {
    const story = await getStory(Number(storyId));
    const content = structuredClone(story.content);
    const applied = applyPatches(content, patches);
    await putStory(story, content);
    record(
      `rollback:${story.slug}`,
      "PASS",
      JSON.stringify({
        applied: applied.applied,
        conflicts: applied.conflicts,
        missing: applied.missing,
      }),
    );
    console.log(JSON.stringify({ slug: story.slug, content }, null, 2));
  }
} else {
  throw new Error(`Unknown phase "${PHASE}"`);
}

const failed = results.filter((result) => result.outcome === "FAIL");
console.log(JSON.stringify({ total: results.length, failed: failed.length }));
process.exit(failed.length > 0 ? 1 : 0);
