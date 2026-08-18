// Fills the seeded `popular-articles` block with the real UUIDs of the seeded
// articles. Story UUIDs are assigned by the CLI on push, so they cannot be
// hardcoded in the scenario. Idempotent: safe to re-run after a re-seed.
//
// Output is asymmetric: on success this prints one JSON line; on failure it
// prints a human-readable message and exits non-zero.
//
// Usage:
//   set -a && source ./.env.qa-engineer-manual && set +a \
//     && node packages/nuxt/test/visual-editor/link-relations.mjs
const token = process.env.STORYBLOK_TOKEN;
const spaceId = process.env.STORYBLOK_SPACE_ID;
const mapiBaseUrl = process.env.STORYBLOK_MAPI_URL ?? "https://mapi.storyblok.com/v1";

if (!token || !spaceId) {
  console.error(
    "Missing STORYBLOK_TOKEN or STORYBLOK_SPACE_ID. Export them from .env.qa-engineer-manual.",
  );
  process.exit(1);
}

const mapi = `${mapiBaseUrl}/spaces/${spaceId}`;
const headers = { Authorization: token, "Content-Type": "application/json" };

const request = async (path, init) => {
  const response = await fetch(`${mapi}${path}`, { ...init, headers });
  if (!response.ok) {
    throw new Error(
      `${init?.method ?? "GET"} ${path} -> ${response.status} ${await response.text()}`,
    );
  }
  return response.json();
};

const { stories } = await request("/stories?per_page=100");

// A folder start page's full_slug carries a trailing slash ("vue/"), while the
// playground and the specs address it without one ("vue"). Normalise both sides.
const normalise = (slug) => slug.replace(/\/$/, "");

const findBySlug = (fullSlug) => {
  const match = stories.find((story) => normalise(story.full_slug) === normalise(fullSlug));
  if (!match) {
    throw new Error(`Story "${fullSlug}" not found. Seed has-playground-content first.`);
  }
  return match;
};

const articleUuids = [
  findBySlug("vue/articles/first-article").uuid,
  findBySlug("vue/articles/second-article").uuid,
];

const startPage = findBySlug("vue");
const { story } = await request(`/stories/${startPage.id}`);

const block = (story.content.body ?? []).find((entry) => entry.component === "popular-articles");
if (!block) {
  throw new Error(
    'No "popular-articles" block on the "vue" start page. Re-seed has-playground-content.',
  );
}

const alreadyLinked =
  block.articles.length === articleUuids.length &&
  articleUuids.every((uuid) => block.articles.includes(uuid));

if (alreadyLinked) {
  console.log(
    JSON.stringify({ outcome: "PASS", details: "already linked", returned: block.articles.length }),
  );
  process.exit(0);
}

block.articles = articleUuids;

// No `publish: 1`: the space stays consistently draft, matching the rest of
// the seed. The playground requests `version: "draft"` anyway.
await request(`/stories/${story.id}`, {
  method: "PUT",
  body: JSON.stringify({ story: { content: story.content } }),
});

console.log(
  JSON.stringify({
    outcome: "PASS",
    function: "link-relations",
    total: articleUuids.length,
    returned: articleUuids.length,
    details: `linked ${articleUuids.join(", ")}`,
  }),
);
