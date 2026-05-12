/* eslint-disable style/no-multi-spaces */
import { z } from 'zod';
import { createApiClient } from '@storyblok/api-client';
import { contentValueSchemas, storySchema } from '@storyblok/schema/zod';
import type { Schema } from '../base/schema';

const client = createApiClient({ accessToken: 'your-token' }).withTypes<Schema>();

// ── contentValueSchemas ──────────────────────────────────────────────────────
//
// `contentValueSchemas` is a Record<FieldType, ZodSchema> that maps every
// Storyblok field type to a runtime validator for its value shape:
//
//   contentValueSchemas.asset      → validates { fieldtype, filename, alt, ... }
//   contentValueSchemas.multilink  → validates { fieldtype, linktype, url, cached_url, ... }
//   contentValueSchemas.richtext   → validates { type: "doc", content: [...] }
//   contentValueSchemas.bloks      → validates nested block arrays
//   contentValueSchemas.text       → z.string()
//   contentValueSchemas.boolean    → z.boolean()
//   contentValueSchemas.number     → z.number()
//   contentValueSchemas.datetime   → z.string() (ISO format)
//   contentValueSchemas.options    → z.array(z.string())
//
// Use them directly for quick validation, or compose with custom constraints
// (max_length, required, regex, defaults) for per-block validators below.

// ── Per-block content validators ─────────────────────────────────────────────

const heroContentSchema = z.object({
  _uid: z.string(),
  component: z.literal('hero'),
  headline: z.string().min(1).max(120),                        // required + max_length: 120
  subtitle: z.string().max(200).default(''),                    // max_length: 200
  image: contentValueSchemas.asset.optional(),                  // asset — structure validated by library
  cta_label: z.string().max(40).default(''),                    // max_length: 40
  cta_link: contentValueSchemas.multilink.optional(),            // multilink — linktype, url, cached_url validated
});

const featureCardContentSchema = z.object({
  _uid: z.string(),
  component: z.literal('feature_card'),
  title: z.string().min(1).max(80),                             // required + max_length: 80
  description: z.string().max(300).default(''),                  // max_length: 300
  image: contentValueSchemas.asset.optional(),                   // asset
  icon: z.string().default(''),                                  // option (datasource value)
  link: contentValueSchemas.multilink.optional(),                // multilink
  is_highlighted: contentValueSchemas.boolean.default(false),    // boolean
  highlight_color: z.string()                                    // text, max_length: 7
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
  title: z.string().max(70).default(''),                        // max_length: 70
  seo_title: z.string().max(70).default(''),                     // max_length: 70
  seo_description: z.string().max(160).default(''),              // max_length: 160
  body: z.array(bodyBlockSchema).default([]),                     // typed body bloks
});

const articleContentSchema = z.object({
  _uid: z.string(),
  component: z.literal('article'),
  title: z.string().min(1).max(120),                             // required + max_length: 120
  excerpt: z.string().max(300).default(''),                       // max_length: 300
  cover_image: contentValueSchemas.asset.optional(),              // asset — validated by library
  author: z.string().max(80).default('Unknown'),                 // max_length: 80, defaulted
  published_at: z.coerce.date().optional(),                       // datetime → coerced to Date
  tags: z.array(z.string()).default([]),                           // options → string[]
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
  //    - asset and multilink fields validated by library schemas via contentValueSchemas
  //    - highlight_color validated as hex (#rrggbb)
  const content = contentSchema.parse(data.story.content);

  if (content.component === 'page') {
    console.log(content.seo_title);
    for (const block of content.body) {
      if (block.component === 'hero') {
        console.log(block.headline);        // validated: min 1, max 120
        console.log(block.cta_link?.url);   // multilink validated by contentValueSchemas
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
    console.log(content.cover_image?.alt);            // validated by contentValueSchemas.asset
  }

  return { ...data.story, content };
}

getValidatedStory('home');
getValidatedStory('blog/hello-world');
