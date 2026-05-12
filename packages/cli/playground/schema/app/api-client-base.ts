import { createApiClient } from '@storyblok/api-client';
import type { Schema } from '../base/schema';

// ── Full-schema client ───────────────────────────────────────────────────────
//
// Recommended for catch-all routes (Next.js [...slug], Nuxt catch-all, etc.)
// where the content type is unknown at compile time.
//
// story.content is a discriminated union over all content types (page | article).
// Narrow by `component` to get per-type fields and fully-typed nested bloks.

const client = createApiClient({ accessToken: 'your-token' }).withTypes<Schema>();

// ── Catch-all route ──────────────────────────────────────────────────────────

async function getStoryBySlug(slug: string) {
  const { data, error } = await client.stories.get(slug);
  if (error || !data) { throw error; }

  const { story } = data;

  // Discriminated union — TypeScript narrows in each branch
  switch (story.content.component) {
    case 'page':
      // <PageHead title={story.content.seo_title} description={story.content.seo_description} />
      console.log(story.content.seo_title);
      console.log(story.content.seo_description);

      // body bloks are typed to page's component_whitelist: hero | feature_card | kitchen_sink
      for (const block of story.content.body ?? []) {
        if (block.component === 'hero') {
          // <HeroBanner headline={block.headline} ctaLabel={block.cta_label} ctaLink={block.cta_link} />
          console.log(block.headline);
          console.log(block.cta_label);
        }
        else if (block.component === 'feature_card') {
          // <FeatureCard title={block.title} highlighted={block.is_highlighted} />
          console.log(block.title);
          console.log(block.is_highlighted);
        }
        else if (block.component === 'empty_block') { // Block exists - but the page.whitelist doesn't include it
          // console.log(block.option_field);
        }
      }
      break;

    case 'article':
      // <ArticleTemplate title={story.content.title} author={story.content.author} />
      console.log(story.content.title);
      console.log(story.content.author);
      console.log(story.content.published_at);
      break;
  }

  return story;
}

getStoryBySlug('home');
getStoryBySlug('blog/hello-world');
