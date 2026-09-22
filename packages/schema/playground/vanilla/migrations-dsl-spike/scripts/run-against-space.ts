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
 *   migrate    apply one migration and park its inverse on disk, so a human can
 *              edit the story in the Storyblok UI before the rollback runs
 *   rollback   replay the parked inverse against whatever the story now holds
 */
import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import { applyPatches, type BlockPatch, indexBlocks } from "../src/patch";
import { runMigrationOnStory } from "../src/runner";
import * as migrations from "../migrations";
import type { CompiledMigration } from "../src/define-migration";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? undefined : args[at + 1];
};

const TOKEN = process.env.STORYBLOK_TOKEN;
const SPACE = process.env.STORYBLOK_SPACE_ID;
const BASE = "https://mapi.storyblok.com/v1";
const PHASE = flag("phase") ?? "roundtrip";
const INVERSE_FILE = flag("inverse-file") ?? ".spike-inverse.json";

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
  const parked: Record<string, BlockPatch[]> = {};
  for (const summary of await listStories()) {
    const story = await getStory(summary.id);
    const run = runMigrationOnStory(migration, story.content);
    if (!run.changed) continue;
    await writeAndVerify(story, run.content, `${which}:${story.slug}`);
    parked[String(story.id)] = run.inverse;
  }
  writeFileSync(INVERSE_FILE, JSON.stringify(parked, null, 2));
  record("migrate", "PASS", `parked inverses for ${Object.keys(parked).length} stories`);
} else if (PHASE === "rollback") {
  const parked: Record<string, BlockPatch[]> = JSON.parse(readFileSync(INVERSE_FILE, "utf8"));
  for (const [id, inverse] of Object.entries(parked)) {
    const story = await getStory(Number(id));
    const content = structuredClone(story.content);
    const applied = applyPatches(content, inverse);
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
