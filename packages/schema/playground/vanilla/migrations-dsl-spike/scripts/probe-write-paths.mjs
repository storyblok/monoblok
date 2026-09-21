// SPIKE probe — the four write-path questions the earlier space run left open,
// answered against a real space through the Management and delivery APIs.
//
// Reads its credentials from the environment; nothing is written to disk.
//
//   set -a && source .env.qa-engineer-manual && set +a
//   node scripts/probe-write-paths.mjs --story <id> --slug <full-slug> --confirm-writes
//
// Every probe restores the story's original content before it returns. It still
// writes to the space, so point it at a QA space only.
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? fallback : args[at + 1];
};
if (!args.includes("--confirm-writes")) {
  console.error("refusing to write without --confirm-writes");
  process.exit(1);
}

const TOKEN = process.env.STORYBLOK_TOKEN;
const SPACE = process.env.STORYBLOK_SPACE_ID;
const PREVIEW = process.env.STORYBLOK_PREVIEW_TOKEN;
const STORY = flag("story");
const SLUG = flag("slug", "spike-article");
if (!TOKEN || !SPACE || !STORY) {
  console.error("needs STORYBLOK_TOKEN, STORYBLOK_SPACE_ID and --story <id>");
  process.exit(1);
}

// The Management API allows 6 requests per second and answers a burst with a
// 429 that looks exactly like a probe failure, so every call is spaced out.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const mapi = async (path, init = {}) => {
  const response = await fetch(`https://mapi.storyblok.com/v1/spaces/${SPACE}${path}`, {
    ...init,
    headers: { Authorization: TOKEN, "Content-Type": "application/json", ...init.headers },
  });
  await sleep(700);
  return { status: response.status, json: await response.json().catch(() => null) };
};
const cdn = async (version, language) => {
  const query = new URLSearchParams({ token: PREVIEW, version, cv: String(Date.now()) });
  if (language) query.set("language", language);
  const response = await fetch(
    `https://api.storyblok.com/v2/cdn/stories/${SLUG}?${query.toString()}`,
  );
  await sleep(400);
  return (await response.json().catch(() => null))?.story?.content;
};

const story = async () => (await mapi(`/stories/${STORY}`)).json.story;
const write = (content, query = "", extra = {}) =>
  mapi(`/stories/${STORY}${query}`, {
    method: "PUT",
    body: JSON.stringify({ story: { name: "Spike Article", content }, ...extra }),
  });
const fieldKeys = (content) => Object.keys(content).filter((key) => /^(author|byline)/.test(key));

const original = (await story()).content;
const renamed = () => {
  const next = structuredClone(original);
  next.byline = next.author;
  delete next.author;
  return next;
};
const report = {};

// 1. A translation is dropped by a rename that moves only the base key.
{
  await write(renamed());
  report.orphanedTranslation = {
    contentKeys: fieldKeys((await story()).content),
    servedInGerman: await cdn("draft", "de"),
  };
  await write(original);
}

// 2. Publishing copies the draft; it neither adds nor normalizes keys. A
//    draft-only rollback therefore leaves the published version migrated.
{
  await write(original, "", { publish: 1 });
  await write(renamed());
  const migrated = await story();
  await write(migrated.content, "", { publish: 1 });
  await write(original);
  report.publishDivergence = {
    draftKeys: fieldKeys((await story()).content),
    publishedKeys: fieldKeys(await cdn("published")),
    unpublishedChanges: (await story()).unpublished_changes,
  };
  await mapi(`/stories/${STORY}/unpublish`);
  await write(original);
}

// 3. Field constraints. Older spaces opt in per request; spaces created after
//    the rollout enforce it unconditionally.
{
  const cases = {
    numberAsJsonNumber: { ...original, price: 42 },
    numberAsString: { ...original, price: "42" },
    numberEmptyString: { ...original, price: "" },
    booleanAsString: { ...original, promoted: "true" },
    requiredFieldBlank: { ...original, title: "" },
    translationWithWrongType: { ...original, price: "42", price__i18n__de: 42 },
  };
  report.fieldConstraints = {};
  for (const [name, content] of Object.entries(cases)) {
    const lenient = await write(content);
    const strict = await write(content, "?strict_mode=1");
    report.fieldConstraints[name] = {
      withoutStrictMode: lenient.status,
      withStrictMode: strict.status,
      error: strict.status >= 400 ? strict.json : undefined,
    };
    await write(original);
  }
}

// 4. A release is a separate content record the plain story endpoints never
//    show, so a migration over stories cannot see or migrate it.
{
  const release = (
    await mapi("/releases", {
      method: "POST",
      body: JSON.stringify({ release: { name: "spike-write-path-probe" } }),
    })
  ).json?.release;
  if (release) {
    await write({ ...original, excerpt: "Release-only excerpt" }, `?release_id=${release.id}`);
    await write(renamed());
    report.release = {
      mainDraftKeys: fieldKeys((await story()).content),
      mainDraftExcerpt: (await story()).content.excerpt,
      releaseKeys: fieldKeys(
        (await mapi(`/stories/${STORY}?release_id=${release.id}`)).json.story.content,
      ),
    };
    await mapi(`/releases/${release.id}`, { method: "DELETE" });
  }
  await write(original);
}

report.restored = fieldKeys((await story()).content);
console.log(JSON.stringify(report, null, 2));
