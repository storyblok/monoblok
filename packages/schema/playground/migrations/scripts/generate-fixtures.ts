/**
 * Writes the committed fixtures the offline runs read.
 *
 * Generated rather than hand-written: a fixture someone edited by hand no longer
 * says anything about what `pnpm seed` produces, and the offline runs would then
 * be exercising content that exists nowhere else.
 *
 * Two sources, same output. `--from-seed` projects the seed story files the push
 * uploads; the default captures the space those files were pushed to, which is
 * the stronger source because it carries whatever the backend normalized on the
 * way in.
 *
 * Usage:
 *   pnpm seed && pnpm fixtures   capture the seeded space
 *   pnpm fixtures --from-seed    project .storyblok/stories/seed/ instead
 */
import "dotenv/config";

import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileContentStore, type PlaygroundStory, spaceContentStore } from "../src/content-store";

const PACKAGE_ROOT = path.resolve(import.meta.dirname, "..");
const FIXTURES_DIR = path.join(PACKAGE_ROOT, "fixtures");
const SEED_DIR = path.join(PACKAGE_ROOT, ".storyblok", "stories", "seed");

async function fromSeedFiles(): Promise<PlaygroundStory[]> {
  const files = (await readdir(SEED_DIR)).filter((file) => file.endsWith(".json")).sort();
  const stories = await Promise.all(
    files.map(async (file) => {
      const seed = JSON.parse(await readFile(path.join(SEED_DIR, file), "utf8"));
      return { id: seed.id, slug: seed.slug, name: seed.name, content: seed.content };
    }),
  );
  return stories.filter((story) => !!story.slug).sort((a, b) => a.id - b.id);
}

async function fromSpace(): Promise<PlaygroundStory[]> {
  const token = process.env.STORYBLOK_TOKEN;
  const space = process.env.STORYBLOK_SPACE_ID;
  if (!token || !space) {
    console.error("Missing required env vars: STORYBLOK_TOKEN, STORYBLOK_SPACE_ID");
    process.exit(1);
  }
  return spaceContentStore({ space, token }).list();
}

const fromSeed = process.argv.includes("--from-seed");
const stories = fromSeed ? await fromSeedFiles() : await fromSpace();

await mkdir(FIXTURES_DIR, { recursive: true });
// A story that was renamed or removed from the seed would otherwise stay behind
// as a fixture nothing produces.
for (const file of await readdir(FIXTURES_DIR)) {
  if (file.endsWith(".json")) {
    await rm(path.join(FIXTURES_DIR, file));
  }
}

const fixtures = fileContentStore(FIXTURES_DIR);
for (const story of stories) {
  await fixtures.put(story);
  console.info(`Wrote ${story.slug}.json`);
}

console.info(
  `${stories.length} fixture(s) in ${FIXTURES_DIR}, ${fromSeed ? "projected from the seed files" : "captured from the space"}.`,
);
