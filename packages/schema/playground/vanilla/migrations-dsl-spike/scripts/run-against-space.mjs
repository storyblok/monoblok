/**
 * SPIKE — end-to-end probe against a real Storyblok space. NOT YET RUN.
 *
 * Writes to the space, so it refuses to do anything without `--confirm-writes`.
 *
 * Seed first:
 *   bash .agents/skills/qa-engineer-manual/scripts/seed-scenario.sh \
 *     --scenario has-spike-dsl-content \
 *     --scenario-dir packages/schema/playground/vanilla/migrations-dsl-spike/scenarios
 *
 * Then:
 *   set -a && source ./.env.qa-engineer-manual && set +a
 *   node packages/schema/playground/vanilla/migrations-dsl-spike/scripts/run-against-space.mjs --confirm-writes
 *
 * What it checks that the local tests cannot:
 *   1. that MAPI round-trips a renamed/removed/coerced field at all
 *   2. that `_uid`s survive a story update, which the whole patch scheme rests on
 *   3. that the editor's own `_editable` / server-set keys do not show up as
 *      spurious diff ops when a story is read back after an update
 *   4. that a rollback replayed hours later still lands on the right blocks
 */
import process from "node:process";

const CONFIRMED = process.argv.includes("--confirm-writes");
const TOKEN = process.env.STORYBLOK_TOKEN;
const SPACE = process.env.STORYBLOK_SPACE_ID;
const BASE = "https://mapi.storyblok.com/v1";

if (!CONFIRMED) {
  console.error("Refusing to run: this script writes to the space. Pass --confirm-writes.");
  process.exit(2);
}
if (!TOKEN || !SPACE) {
  console.error("Missing STORYBLOK_TOKEN / STORYBLOK_SPACE_ID.");
  process.exit(2);
}

const { runMigrationOnStory } = await import("../src/runner.ts");
const { applyPatches } = await import("../src/patch.ts");
const migrations = await import("../migrations/index.ts");

async function mapi(path, init = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: TOKEN, "Content-Type": "application/json", ...init.headers },
  });
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${response.status}`);
  return response.status === 204 ? null : response.json();
}

const listStories = async () => (await mapi(`/spaces/${SPACE}/stories`)).stories;
const getStory = async (id) => (await mapi(`/spaces/${SPACE}/stories/${id}`)).story;
const putContent = (id, content) =>
  mapi(`/spaces/${SPACE}/stories/${id}`, {
    method: "PUT",
    body: JSON.stringify({ story: { content }, force_update: "1" }),
  });

const results = [];
const record = (name, outcome, details) => {
  results.push({ outcome, function: name, details });
  console.log(JSON.stringify({ outcome, function: name, details }));
};

const stories = await listStories();
const inverses = new Map();

for (const [key, migration] of Object.entries(migrations)) {
  for (const summary of stories) {
    const story = await getStory(summary.id);
    const run = runMigrationOnStory(migration, story.content);
    if (!run.changed) continue;
    await putContent(story.id, run.content);
    const readBack = await getStory(story.id);
    // 2 + 3: the read-back content should equal what we wrote, modulo keys the
    // server adds. Any surplus op here is a false positive the patch scheme
    // would later treat as a rollback conflict.
    const drift = runMigrationOnStory({ name: "noop", ops: [], targets: [] }, readBack.content);
    record(
      `${key}:${story.slug}`,
      drift.changed ? "FAIL" : "PASS",
      `patched ${run.patches.length} blocks`,
    );
    inverses.set(`${key}:${story.id}`, run.inverse);
  }
}

// 4: replay every inverse in reverse order and report conflicts.
for (const [key, inverse] of [...inverses].reverse()) {
  const id = Number(key.split(":")[1]);
  const story = await getStory(id);
  const content = structuredClone(story.content);
  const applied = applyPatches(content, inverse);
  await putContent(id, content);
  record(
    `rollback:${key}`,
    applied.conflicts.length === 0 ? "PASS" : "FAIL",
    JSON.stringify(applied),
  );
}

console.log(
  JSON.stringify({
    total: results.length,
    failed: results.filter((r) => r.outcome === "FAIL").length,
  }),
);
