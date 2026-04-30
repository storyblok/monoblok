/**
 * Validation playground — schema definitions + runtime content validation.
 *
 * Shows how `@storyblok/schema` and its Zod layer work together:
 * - `componentSchema` / `fieldSchema` validate MAPI component definitions (before push)
 * - `contentValueSchemas` validate CAPI content values at runtime (after fetch)
 * - `storyCreateSchema` validates story payloads before writing via MAPI
 *
 * Run: pnpm validate
 */
import type { Schema as InferSchema } from '@storyblok/schema';
import { createStoryHelpers } from '@storyblok/schema/mapi';
import { contentValueSchemas } from '@storyblok/schema/zod';
import { componentSchema, storyCreateSchema } from '@storyblok/schema/zod/mapi';

import { featureCardBlock } from '../base/components/feature-card';
import { heroBlock } from '../base/components/hero';
import { pageBlock } from '../base/components/page';
import type { schema } from '../base/schema';

// ── Types ────────────────────────────────────────────────────────────

type Schema = InferSchema<typeof schema>;
type Blocks = Schema['blocks'];
interface StoryblokTypes { components: Blocks }

const { defineStoryCreate } = createStoryHelpers().withTypes<StoryblokTypes>();

// ── Validate component definitions (MAPI) ────────────────────────────
//
// Same validation the CLI runs before `schema push`.

console.log('--- Component definitions ---\n');

console.log('heroBlock:', componentSchema.safeParse(heroBlock).success);
console.log('featureCardBlock:', componentSchema.safeParse(featureCardBlock).success);
console.log('pageBlock:', componentSchema.safeParse(pageBlock).success);

// ── Validate content values (CAPI) ──────────────────────────────────
//
// After fetching a story from the Content Delivery API, validate
// individual field values using the Zod schema for each field type.

console.log('\n--- Hero content values ---\n');

console.log('headline (text):', contentValueSchemas.text.safeParse('Code-driven content, fully typed.').success);

console.log('image (asset):', contentValueSchemas.asset.safeParse({
  fieldtype: 'asset',
  id: 456,
  alt: 'Hero banner',
  filename: 'https://a.storyblok.com/f/12345/hero.jpg',
}).success);

console.log('cta_link (multilink):', contentValueSchemas.multilink.safeParse({
  fieldtype: 'multilink',
  id: 'link-1',
  url: '/docs',
  linktype: 'story',
  cached_url: '/docs',
}).success);

console.log('\n--- Feature card content values ---\n');

console.log('title (text):', contentValueSchemas.text.safeParse('Type-safe schemas').success);
console.log('description (textarea):', contentValueSchemas.textarea.safeParse('Define once, use everywhere.').success);
console.log('icon (option):', contentValueSchemas.option.safeParse('rocket').success);
console.log('is_highlighted (boolean):', contentValueSchemas.boolean.safeParse(true).success);

// ── Validate a story payload (MAPI write) ────────────────────────────
//
// Build a typed story with `defineStoryCreate`, then validate the
// full payload before sending it to the Management API.

console.log('\n--- Story payload ---\n');

const homeStory = defineStoryCreate(pageBlock, {
  name: 'Home',
  slug: 'home',
  content: {
    seo_title: 'Welcome to our site',
    seo_description: 'A demo built with @storyblok/schema.',
    body: [
      {
        component: heroBlock.name,
        headline: 'Code-driven content, fully typed.',
        subtitle: null,
        image: null,
        cta_label: null,
        cta_link: null,
      },
      {
        component: featureCardBlock.name,
        title: 'Type-safe schemas',
        description: 'Define once, use everywhere.',
        image: null,
        icon: null,
        link: null,
        is_highlighted: false,
        highlight_color: null,
      },
    ],
  },
});

console.log('storyCreate:', storyCreateSchema.safeParse(homeStory).success);
console.log('  name:', homeStory.name);
console.log('  slug:', homeStory.slug);
console.log('  root:', homeStory.content.component);
console.log('  blocks:', homeStory.content.body.map(b => b.component).join(', '));
