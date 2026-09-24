/**
 * Writes the committed fixtures the offline runs read.
 *
 * Generated rather than hand-written: a fixture someone edited by hand no longer
 * says anything about what `pnpm seed` produces, and the offline runs would then
 * be exercising content that exists nowhere else.
 *
 * Two sources for the pushed stories, same output. `--from-seed` projects the
 * seed story files; the default captures the space they were pushed to, which is
 * the stronger source because it carries whatever the backend normalized on the
 * way in.
 *
 * `.storyblok/stories/offline/` is added to both. Those stories cannot be pushed
 * at all: `stories push` validates content against the local schema and refuses a
 * field the schema does not declare, which is precisely what pre-migration
 * content is made of. They are projected from their files or they do not exist.
 *
 * A projection cannot replace a capture by accident: `--from-seed` refuses when
 * the committed fixtures came from a space, because the values only a space can
 * produce would be silently replaced by the ones we wrote down.
 *
 * Usage:
 *   pnpm seed && pnpm fixtures              capture the seeded space
 *   pnpm fixtures --from-seed               project .storyblok/stories/seed/ instead
 *   pnpm fixtures --from-seed --replace-captured   the same, over captured fixtures
 */
import "dotenv/config";

import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { capturedSlugs } from "../src/captured-fixtures";
import { fileContentStore, type PlaygroundStory, spaceContentStore } from "../src/content-store";

const PACKAGE_ROOT = path.resolve(import.meta.dirname, "..");
const FIXTURES_DIR = path.join(PACKAGE_ROOT, "fixtures");
const SEED_DIR = path.join(PACKAGE_ROOT, ".storyblok", "stories", "seed");
const OFFLINE_DIR = path.join(PACKAGE_ROOT, ".storyblok", "stories", "offline");

async function projectFrom(directory: string): Promise<PlaygroundStory[]> {
  const files = (await readdir(directory)).filter((file) => file.endsWith(".json")).sort();
  const stories = await Promise.all(
    files.map(async (file) => {
      const seed = JSON.parse(await readFile(path.join(directory, file), "utf8"));
      return { id: seed.id, slug: seed.slug, name: seed.name, content: seed.content };
    }),
  );
  return stories.filter((story) => !!story.slug);
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
const replaceCaptured = process.argv.includes("--replace-captured");

if (fromSeed && !replaceCaptured) {
  const captured = capturedSlugs(
    await projectFrom(SEED_DIR),
    await fileContentStore(FIXTURES_DIR)
      .list()
      .catch((): PlaygroundStory[] => []),
  );
  if (captured.length > 0) {
    console.error(
      `Refusing to overwrite captured fixtures: ${captured.join(", ")}.\n` +
        "They came back from a space and carry what it normalized on the way in, which a\n" +
        "projection cannot reproduce: a story-sourced option holds the story's uuid rather\n" +
        "than its slug, a story link holds one too, and an asset carries a real CDN URL.\n" +
        "Run `pnpm seed && pnpm fixtures` to capture them again, or pass --replace-captured\n" +
        "to project over them anyway.",
    );
    process.exit(2);
  }
}

const pushed = fromSeed ? await projectFrom(SEED_DIR) : await fromSpace();
const stories = [...pushed, ...(await projectFrom(OFFLINE_DIR))].sort((a, b) => a.id - b.id);

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
  `${stories.length} fixture(s) in ${FIXTURES_DIR}: ${pushed.length} ${
    fromSeed ? "projected from the seed files" : "captured from the space"
  }, the rest projected from the offline stories.`,
);
