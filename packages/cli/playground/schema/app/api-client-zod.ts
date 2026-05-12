/* eslint-disable style/no-multi-spaces */
import { z } from 'zod';
import { createApiClient } from '@storyblok/api-client';
import { storySchema } from '@storyblok/schema/zod';
import type { Schema } from '../base/schema';

const client = createApiClient({ accessToken: 'your-token' }).withTypes<Schema>();

// ── Shared field validators ──────────────────────────────────────────────────
//
// Reusable zod schemas for Storyblok field value shapes.
// These mirror the field types from defineField — same constraints, plus
// runtime coercion and defaults that TypeScript alone can't enforce.

const imageAssetSchema = z.object({
  filename: z.string().url(),
  alt: z.string().default(''),
}).refine(
  // eslint-disable-next-line regexp/no-unused-capturing-group
  a => /\.(jpe?g|png|gif|webp|svg|avif)$/i.test(a.filename),
  { message: 'Expected an image file (jpg, png, gif, webp, svg, avif)' },
);

const multilinkSchema = z.object({
  linktype: z.enum(['url', 'story', 'email', 'asset']).optional(),
  url: z.string().default(''),
  cached_url: z.string().default(''),
  target: z.string().default(''),
});

// ── Nestable block validators ────────────────────────────────────────────────
//
// Each schema mirrors its defineBlock field-by-field:
//   defineField('headline', { type: 'text', max_length: 120, required: true })
//   → z.string().min(1).max(120)

const heroContentSchema = z.object({
  _uid: z.string(),
  component: z.literal('hero'),
  headline: z.string().min(1).max(120),                   // required + max_length: 120
  subtitle: z.string().max(200).default(''),               // max_length: 200
  image: imageAssetSchema.optional(),                      // asset, filetypes: ['images']
  cta_label: z.string().max(40).default(''),               // max_length: 40
  cta_link: multilinkSchema.optional(),                    // multilink
});

const featureCardContentSchema = z.object({
  _uid: z.string(),
  component: z.literal('feature_card'),
  title: z.string().min(1).max(80),                        // required + max_length: 80
  description: z.string().max(300).default(''),             // max_length: 300
  image: imageAssetSchema.optional(),                      // asset, filetypes: ['images']
  icon: z.string().default(''),                            // option (datasource value)
  link: multilinkSchema.optional(),                        // multilink
  is_highlighted: z.boolean().default(false),              // boolean
  highlight_color: z.string()                              // text, max_length: 7
    .max(7)
    .regex(/^#[0-9a-f]{6}$/i, 'Expected a hex color (#rrggbb)')
    .optional(),
});

// ── Content type validators ──────────────────────────────────────────────────

const bodyBlockSchema = z.discriminatedUnion('component', [
  heroContentSchema,
  featureCardContentSchema,
]);

const pageContentSchema = z.object({
  _uid: z.string(),
  component: z.literal('page'),
  title: z.string().max(70).default(''),                   // max_length: 70
  seo_title: z.string().max(70).default(''),               // max_length: 70
  seo_description: z.string().max(160).default(''),        // max_length: 160
  body: z.array(bodyBlockSchema).default([]),               // bloks with typed union
});

const articleContentSchema = z.object({
  _uid: z.string(),
  component: z.literal('article'),
  title: z.string().min(1).max(120),                       // required + max_length: 120
  excerpt: z.string().max(300).default(''),                 // max_length: 300
  cover_image: imageAssetSchema.optional(),                // asset, filetypes: ['images']
  author: z.string().max(80).default('Unknown'),           // max_length: 80, defaulted
  published_at: z.coerce.date().optional(),                // datetime → coerced to Date
  tags: z.array(z.string()).default([]),                   // options → string[]
});

// Discriminated union mirrors the TypeScript union from Schema
const contentSchema = z.discriminatedUnion('component', [
  pageContentSchema,
  articleContentSchema,
]);

// ── Fetch + validate ─────────────────────────────────────────────────────────

async function getValidatedStory(slug: string) {
  const { data, error } = await client.stories.get(slug);
  if (error || !data) { throw error; }

  // 1. Validate the story envelope (name, slug, uuid, etc.)
  storySchema.parse(data.story);

  // 2. Validate and coerce content per-field
  //    - max_length constraints enforced at runtime
  //    - published_at coerced from ISO string to Date
  //    - missing optional fields get defaults (empty string, empty array, 'Unknown')
  //    - image assets validated for file extension
  //    - highlight_color validated as hex (#rrggbb)
  const content = contentSchema.parse(data.story.content);

  if (content.component === 'page') {
    // seo_title is string (defaulted to '' if missing)
    console.log(content.seo_title);
    // body is a typed array — each block validated per its own schema
    for (const block of content.body) {
      if (block.component === 'hero') {
        console.log(block.headline);        // validated: min 1, max 120
        console.log(block.cta_link?.url);   // multilinkSchema applied
      }
      else if (block.component === 'feature_card') {
        console.log(block.title);           // validated: min 1, max 80
        console.log(block.highlight_color); // validated: hex regex
      }
    }
  }

  if (content.component === 'article') {
    console.log(content.title);                       // validated: min 1, max 120
    console.log(content.author);                      // defaulted to 'Unknown'
    console.log(content.published_at?.toISOString()); // coerced string → Date
    console.log(content.tags.length);                 // defaulted to []
    console.log(content.cover_image?.alt);            // image asset validated
  }

  return { ...data.story, content };
}

getValidatedStory('home');
getValidatedStory('blog/hello-world');
