import { createApiClient } from '@storyblok/api-client';
import type { contentTypes } from '../base/schema';

// ── Per-content-type clients ─────────────────────────────────────────────────
//
// When you know which content type an endpoint serves, narrow the client to
// that root. No discriminated union, no switch — the content fields are
// directly available.
//
// `ContentType<K>` wraps the block in `{ blocks: ... }` (what withTypes requires).
// Keys match block names: 'page', 'article'.

const base = createApiClient({ accessToken: 'your-token' });
const pageClient = base.withTypes<{ blocks: typeof contentTypes.pageBlock }>();
const blogClient = base.withTypes<{ blocks: typeof contentTypes.articleBlock }>();

// ── getHomePage — typed as `page` ────────────────────────────────────────────

async function getHomePage() {
  const { data, error } = await pageClient.stories.get('home');
  if (error || !data) { throw error; }

  const { story } = data;

  // story.content is `page` — no narrowing needed, fields are directly available
  // <PageHead title={story.content.seo_title} description={story.content.seo_description} />
  console.log(story.content.seo_title);
  console.log(story.content.seo_description);

  return story;
}

// ── listBlogPosts — typed as `article` ───────────────────────────────────────

async function listBlogPosts() {
  const { data, error } = await blogClient.stories.list({
    query: { starts_with: 'blog/', per_page: 25 },
  });
  if (error || !data) { throw error; }

  for (const story of data.stories) {
    // story.content is `article` — completely different fields from `page`
    // <ArticleCard title={story.content.title} author={story.content.author} date={story.content.published_at} />
    console.log(story.content.title);
    console.log(story.content.author);
    console.log(story.content.published_at);
    console.log(story.content.tags);
  }

  return data.stories;
}

getHomePage();
listBlogPosts();
