import { createApiClient } from '@storyblok/api-client';
import type { Schema } from '../base/schema';

/**
 * Pass your `Schema` type to `.withTypes<Schema>()`.
 *
 * This single call locks in the full type graph:
 *   - `stories.get()` returns a story whose `content` is typed to root blocks only.
 *   - Nested `bloks` fields become discriminated unions over all nestable blocks.
 *   - `component_whitelist` constraints are respected — only whitelisted blocks
 *     appear in each field's union.
 */
const client = createApiClient({ accessToken: 'your-token' })
  .withTypes<Schema>();

// ── Single story ─────────────────────────────────────────────────────────────

async function getHomePage() {
  const { data } = await client.stories.get('home');
  if (!data) { return; }

  const { story } = data;

  // content is typed to root blocks (page) — SEO fields are known
  console.log(story.content.seo_title);
  console.log(story.content.seo_description);

  // body is a discriminated union — narrow by `component`
  for (const block of story.content.body ?? []) {
    if (block.component === 'hero') {
      console.log(block.cta_label);
      console.log(block.cta_link);
    }
    else if (block.component === 'feature_card') {
      console.log(block.title);
      console.log(block.is_highlighted);
    }
    else if (block.component === 'kitchen_sink') {
      console.log(block.option_field);
    }
    else if (block.component === 'empty_block') { // component exists, but page.allow_list doesn't include it
      console.log(block);
    }
  }
}

// ── Story listing ─────────────────────────────────────────────────────────────

async function listBlogPosts() {
  const { data } = await client.stories.list({
    query: { starts_with: 'blog/', per_page: 25 },
  });
  if (!data) { return; }

  for (const story of data.stories) {
    // Each story's content is typed to root blocks (page)
    console.log(story.name, story.content.seo_title);
  }
}

getHomePage();
listBlogPosts();
