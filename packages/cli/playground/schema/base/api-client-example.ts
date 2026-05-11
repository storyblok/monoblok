import { createApiClient } from '@storyblok/api-client';
import type { Blocks } from './schema';

/**
 * Pass the `Blocks` union from your schema to `.withTypes()` to get
 * fully typed story responses — discriminated by `content.component`.
 */
const client = createApiClient({ accessToken: 'your-token' })
  .withTypes<{ components: Blocks }>();

async function example() {
  const { data } = await client.stories.get('home');

  if (data) {
    const { story } = data;

    // Top-level content is typed to root blocks only (page)
    console.log(story.content.seo_title);

    // Nested bloks fields are discriminated unions
    for (const block of story.content.body ?? []) {
      if (block.component === 'hero') {
        // Fully typed — TS knows these are hero fields
        console.log(block.headline);
        console.log(block.image);
      }

      if (block.component === 'feature_card') {
        console.log(block.title);
      }
    }
  }
}

example();
