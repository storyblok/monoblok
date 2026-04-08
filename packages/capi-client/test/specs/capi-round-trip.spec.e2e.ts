/**
 * End-to-end test: @storyblok/schema define functions → CAPI round-trip
 *
 * Validates that:
 *  1. Components and stories created via the MAPI are readable via the CAPI.
 *  2. The schema-aware capi-client returns properly narrowed types through
 *     the compiled DTS (not source imports) — proving the mapped-type fix
 *     for tsdown DTS inlining works for the CAPI client too.
 *  3. Nested blok fields (body[0]) resolve to typed component content, not `never`.
 *  4. Discriminated union narrowing works after component guard checks.
 *
 * Run manually (never in CI):
 *   pnpm --filter @storyblok/api-client test:e2e
 *
 * Requires .env.qa-engineer-manual at the repo root with:
 *   STORYBLOK_TOKEN=<personal-access-token>
 *   STORYBLOK_SPACE_ID=<numeric-space-id>
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createManagementApiClient } from '@storyblok/management-api-client';
import { createApiClient } from '@storyblok/api-client';
import {
  defineBlock,
  defineField,
  defineProp,
} from '@storyblok/schema';
import {
  createStoryHelpers,
  defineBlockCreate,
} from '@storyblok/schema/mapi';
import { spaceSchema, storySchema } from '@storyblok/schema/zod';

const token = process.env.STORYBLOK_TOKEN!;
const spaceId = Number(process.env.STORYBLOK_SPACE_ID!);

const PREFIX = 'e2e_capi_';
const STORY_SLUG_PREFIX = 'e2e-capi-';
const STORY_SLUG = `${STORY_SLUG_PREFIX}test-page`;

const teaserComponent = defineBlock({
  name: `${PREFIX}teaser`,
  schema: {
    title: defineProp(defineField({ type: 'text' }), { pos: 0, required: true }),
    image: defineProp(defineField({ type: 'asset' }), { pos: 1 }),
  },
});
// Level-2 container: holds teasers in its `items` bloks field (level 3)
const sectionComponent = defineBlock({
  name: `${PREFIX}section`,
  schema: {
    title: defineProp(defineField({ type: 'text' }), { pos: 0 }),
    items: defineProp(
      defineField({ type: 'bloks', component_whitelist: [teaserComponent.name] }),
      { pos: 1, required: true },
    ),
  },
});
const pageComponent = defineBlock({
  name: `${PREFIX}page`,
  is_root: true,
  schema: {
    headline: defineProp(defineField({ type: 'text' }), { pos: 0, required: true }),
    rating: defineProp(defineField({ type: 'number' }), { pos: 1 }),
    is_featured: defineProp(defineField({ type: 'boolean' }), { pos: 2 }),
    body: defineProp(
      defineField({ type: 'bloks', component_whitelist: [teaserComponent.name, sectionComponent.name] }),
      { pos: 3, required: true },
    ),
    any_blocks: defineProp(
      defineField({ type: 'bloks' }),
      { pos: 4, required: true },
    ),
  },
});

interface StoryblokTypes {
  components: typeof pageComponent | typeof teaserComponent | typeof sectionComponent;
}

const { defineStoryCreate } = createStoryHelpers().withTypes<StoryblokTypes>();

function createTypedCapiClient(accessToken: string) {
  return createApiClient({ accessToken, throwOnError: true }).withTypes<StoryblokTypes>();
}

const mapiClient = createManagementApiClient({
  personalAccessToken: token,
  spaceId,
  throwOnError: true,
}).withTypes<StoryblokTypes>();

async function cleanup() {
  // Stories
  const storiesRes = await mapiClient.stories.list({ query: { per_page: 100 } });
  for (const story of storiesRes.data?.stories ?? []) {
    if (story.slug.startsWith(STORY_SLUG_PREFIX) && story.id) {
      await mapiClient.stories.delete(story.id);
    }
  }

  // Components
  const compsRes = await mapiClient.components.list();
  for (const comp of compsRes.data?.components ?? []) {
    if (comp.name.startsWith(PREFIX) && comp.id) {
      await mapiClient.components.delete(comp.id);
    }
  }
}

describe('schema + capi-client CAPI round-trip', () => {
  let storyId: number;
  let previewToken: string;

  beforeAll(async () => {
    await cleanup();

    // 1. Get the space's preview token for CAPI access
    const spaceRes = await mapiClient.spaces.get();
    previewToken = spaceRes.data!.space!.first_token!;
    expect(previewToken).toBeTruthy();

    // 2. Create teaser component (innermost — whitelisted by section)
    const teaserPayload = defineBlockCreate({
      name: teaserComponent.name,
      schema: {
        title: { type: 'text', required: true, pos: 0 },
        image: { type: 'asset', pos: 1 },
      },
    });
    await mapiClient.components.create({ body: { component: teaserPayload } });

    // 3. Create section component (level 2 — whitelists teaser, whitelisted by page)
    const sectionPayload = defineBlockCreate({
      name: sectionComponent.name,
      schema: {
        title: { type: 'text', pos: 0 },
        items: { type: 'bloks', component_whitelist: [teaserComponent.name], pos: 1 },
      },
    });
    await mapiClient.components.create({ body: { component: sectionPayload } });

    // 4. Create page component (level 1 — whitelists both teaser and section)
    const pagePayload = defineBlockCreate({
      name: pageComponent.name,
      schema: {
        headline: { type: 'text', required: true, pos: 0 },
        rating: { type: 'number', pos: 1 },
        is_featured: { type: 'boolean', pos: 2 },
        body: { type: 'bloks', component_whitelist: [teaserComponent.name, sectionComponent.name], pos: 3 },
        any_blocks: { type: 'bloks', pos: 4 },
      },
      is_root: true,
    });
    await mapiClient.components.create({ body: { component: pagePayload } });

    // 5. Create story: body[0]=teaser (level 2), body[1]=section{items:[teaser]} (levels 2+3)
    const storyPayload = defineStoryCreate(pageComponent, {
      name: 'E2E CAPI Test Page',
      slug: STORY_SLUG,
      content: {
        headline: 'Hello from CAPI e2e',
        rating: 42,
        is_featured: true,
        body: [
          {
            component: teaserComponent.name,
            title: 'Teaser Title',
          },
          {
            component: sectionComponent.name,
            title: 'Section Title',
            items: [
              {
                component: teaserComponent.name,
                title: 'Nested Teaser Title',
              },
            ],
          },
        ],
        any_blocks: [
          {
            component: teaserComponent.name,
            title: 'Any Block Teaser',
          },
        ],
      },
    });
    const storyRes = await mapiClient.stories.create({ body: { story: storyPayload } });
    storyId = storyRes.data!.story!.id!;

    // 6. Publish the story so it's accessible via the CAPI
    await mapiClient.stories.publish(storyId);
  });

  afterAll(cleanup);

  describe('stories.get', () => {
    it('should match defined schema field types at runtime for story content', async () => {
      const capiClient = createTypedCapiClient(previewToken);
      const res = await capiClient.stories.get(STORY_SLUG);
      const story = res.data?.story;

      expect(story).toBeDefined();
      expect(story?.slug).toBe(STORY_SLUG);

      // TypeScript narrows story.content to the pageComponent branch here.
      // Accessing story.content.headline etc. only compiles when the component guard passes,
      // so this block validates both runtime correctness and compile-time type narrowing.
      if (story?.content?.component === pageComponent.name) {
        expect(typeof story.content.headline).toBe('string');
        expect(story.content.headline).toBe('Hello from CAPI e2e');

        expect(typeof story.content.rating).toBe('number');
        expect(story.content.rating).toBe(42);

        expect(typeof story.content.is_featured).toBe('boolean');
        expect(story.content.is_featured).toBe(true);

        expect(Array.isArray(story.content.body)).toBe(true);
        expect(story.content.body.length).toBeGreaterThan(0);
      }
      else {
        throw new Error(
          `Expected story.content.component to be '${pageComponent.name}', got '${story?.content?.component}'`,
        );
      }
    });

    it('should have correct structure for nested teaser blok (body[0] is not never)', async () => {
      const capiClient = createTypedCapiClient(previewToken);
      const res = await capiClient.stories.get(STORY_SLUG);
      const story = res.data?.story;

      if (story?.content?.component === pageComponent.name) {
        // This is the core assertion: body[0] must resolve to a typed teaser
        // content object (with .component, .title, etc.), NOT `never`.
        // Before the mapped-type fix, tsdown's DTS inlining collapsed the
        // FullSchema parameter, causing body[0] to resolve to `never`.
        const teaser = story.content.body[0];

        if (teaser.component === teaserComponent.name) {
          expect(typeof teaser.title).toBe('string');
          expect(teaser.title).toBe('Teaser Title');
        }
        else {
          throw new Error(`Expected body[0].component to be '${teaserComponent.name}', got '${teaser?.component}'`);
        }
      }
      else {
        throw new Error('Unexpected component discriminant');
      }
    });

    it('should resolve correct types for three-level nested blok (page → section → teaser)', async () => {
      const capiClient = createTypedCapiClient(previewToken);
      const res = await capiClient.stories.get(STORY_SLUG);
      const story = res.data?.story;

      if (story?.content?.component === pageComponent.name) {
        // Level 2: narrow body[1] to section
        const section = story.content.body[1];

        if (section.component === sectionComponent.name) {
          expect(typeof section.title).toBe('string');
          expect(section.title).toBe('Section Title');
          expect(Array.isArray(section.items)).toBe(true);
          expect(section.items.length).toBeGreaterThan(0);

          // Level 3: section.items[0] is a typed teaser — not `never`
          const nestedTeaser = section.items[0];

          if (nestedTeaser.component === teaserComponent.name) {
            expect(typeof nestedTeaser.title).toBe('string');
            expect(nestedTeaser.title).toBe('Nested Teaser Title');
          }
          else {
            throw new Error(`Expected items[0].component to be '${teaserComponent.name}', got '${nestedTeaser.component}'`);
          }
        }
        else {
          throw new Error(`Expected body[1].component to be '${sectionComponent.name}', got '${section.component}'`);
        }
      }
      else {
        throw new Error('Unexpected component discriminant at level 1');
      }
    });

    it('should resolve all schema component types for bloks field without whitelist', async () => {
      const capiClient = createTypedCapiClient(previewToken);
      const res = await capiClient.stories.get(STORY_SLUG);
      const story = res.data?.story;

      if (story?.content?.component === pageComponent.name) {
        // any_blocks has no component_whitelist — TypeScript resolves items to the full
        // schema union (page | teaser | section), not `never` and not a generic block
        // with only component: string. Accessing blok.title after narrowing to the
        // teaser discriminant proves the discriminated union is correctly typed.
        const blok = story.content.any_blocks[0];
        if (blok.component === teaserComponent.name) {
          expect(typeof blok.title).toBe('string');
          expect(blok.title).toBe('Any Block Teaser');
        }
        else {
          throw new Error(`Expected any_blocks[0].component to be '${teaserComponent.name}', got '${blok.component}'`);
        }
      }
      else {
        throw new Error('Unexpected component discriminant');
      }
    });
  });

  describe('zod validation', () => {
    it('should pass Zod storySchema validation for a fetched CAPI story', async () => {
      const capiClient = createApiClient({ accessToken: previewToken });
      const res = await capiClient.stories.get(STORY_SLUG);
      const result = storySchema.safeParse(res.data?.story);
      expect(result.success, JSON.stringify(result.error?.issues, null, 2)).toBe(true);
    });

    it('should pass Zod spaceSchema validation for the space info response', async () => {
      const capiClient = createApiClient({ accessToken: previewToken });
      const spaceRes = await capiClient.spaces.get();
      const result = spaceSchema.safeParse(spaceRes.data?.space);
      expect(result.success, JSON.stringify(result.error?.issues, null, 2)).toBe(true);
    });
  });

  describe('stories.list', () => {
    it('should return narrowed types including three-level nesting for stories list', async () => {
      const capiClient = createTypedCapiClient(previewToken);

      const res = await capiClient.stories.list({
        query: { starts_with: STORY_SLUG_PREFIX },
      });
      const stories = res.data?.stories;

      expect(stories).toBeDefined();
      expect(stories!.length).toBeGreaterThan(0);

      const story = stories![0];
      if (story.content.component === pageComponent.name) {
        expect(typeof story.content.headline).toBe('string');
        expect(Array.isArray(story.content.body)).toBe(true);

        // Validate two-level narrowing (body[0] = teaser)
        const first = story.content.body[0];
        if (first.component === teaserComponent.name) {
          expect(typeof first.title).toBe('string');
        }

        // Validate three-level narrowing (body[1] = section → items[0] = teaser)
        const second = story.content.body[1];
        if (second.component === sectionComponent.name) {
          expect(Array.isArray(second.items)).toBe(true);
          const nestedTeaser = second.items[0];
          if (nestedTeaser.component === teaserComponent.name) {
            expect(typeof nestedTeaser.title).toBe('string');
          }
        }
      }
    });
  });
});
