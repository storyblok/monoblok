/**
 * End-to-end test: @storyblok/schema define functions → MAPI round-trip
 *
 * Validates that:
 *  1. Every major MAPI define function produces a valid creation payload.
 *  2. The MAPI accepts those payloads and creates real resources.
 *  3. The types returned by the schema-aware mapi-client match the actual
 *     runtime data returned by the API (no type lies).
 *  4. Zod schemas generated from the OpenAPI spec accept real API responses.
 *
 * Run manually (never in CI):
 *   pnpm --filter @storyblok/management-api-client test:e2e
 *
 * Requires .env.qa-engineer-manual at the repo root with:
 *   STORYBLOK_TOKEN=<personal-access-token>
 *   STORYBLOK_SPACE_ID=<numeric-space-id>
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createManagementApiClient } from '@storyblok/management-api-client';
import {
  defineBlock,
  defineField,
  defineProp,
} from '@storyblok/schema';
import {
  createStoryHelpers,
  defineBlockCreate,
  defineBlockFolderCreate,
  defineDatasourceCreate,
  defineDatasourceEntryCreate,
  defineInternalTagCreate,
  definePresetCreate,
} from '@storyblok/schema/mapi';
import {
  componentSchema,
  datasourceEntrySchema,
  datasourceSchema,
  storySchema,
} from '@storyblok/schema/zod/mapi';

const token = process.env.STORYBLOK_TOKEN!;
const spaceId = Number(process.env.STORYBLOK_SPACE_ID!);

const PREFIX = 'e2e_schema_';
const STORY_SLUG_PREFIX = 'e2e-schema-';

const DATASOURCE_SLUG = 'e2e-schema-categories';
const DATASOURCE_NAME = `${PREFIX}categories`;
const STORY_NAME = 'E2E Schema Test Page';
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
    description: defineProp(defineField({ type: 'richtext' }), { pos: 3 }),
    body: defineProp(
      defineField({ type: 'bloks', component_whitelist: [teaserComponent.name, sectionComponent.name] }),
      { pos: 4, required: true },
    ),
    category: defineProp(
      defineField({ type: 'option', source: 'internal', datasource_slug: DATASOURCE_SLUG }),
      { pos: 5 },
    ),
    any_blocks: defineProp(
      defineField({ type: 'bloks' }),
      { pos: 6, required: true },
    ),
  },
});

interface StoryblokTypes {
  components: typeof pageComponent | typeof teaserComponent | typeof sectionComponent;
}

const { defineStoryCreate, defineStoryUpdate } = createStoryHelpers().withTypes<StoryblokTypes>();

const client = createManagementApiClient({
  personalAccessToken: token,
  spaceId,
  throwOnError: true,
}).withTypes<StoryblokTypes>();

async function cleanup() {
  // Stories
  const storiesRes = await client.stories.list({ query: { per_page: 100 } });
  for (const story of storiesRes.data?.stories ?? []) {
    if (story.slug?.startsWith(STORY_SLUG_PREFIX) && story.id) {
      await client.stories.delete(story.id);
    }
  }

  // Presets
  const presetsRes = await client.presets.list();
  for (const preset of presetsRes.data?.presets ?? []) {
    if (preset.name?.startsWith(PREFIX) && preset.id) {
      await client.presets.delete(preset.id);
    }
  }

  // Internal tags
  const tagsRes = await client.internalTags.list();
  for (const tag of tagsRes.data?.internal_tags ?? []) {
    if (tag.name?.startsWith(PREFIX) && tag.id) {
      await client.internalTags.delete(tag.id);
    }
  }

  // Components
  const compsRes = await client.components.list();
  for (const comp of compsRes.data?.components ?? []) {
    if (comp.name?.startsWith(PREFIX) && comp.id) {
      await client.components.delete(comp.id);
    }
  }

  // Component folders
  const foldersRes = await client.componentFolders.list();
  for (const folder of foldersRes.data?.component_groups ?? []) {
    if (folder.name?.startsWith(PREFIX) && folder.id) {
      await client.componentFolders.delete(folder.id);
    }
  }

  // Datasource entries, then datasources
  const dsRes = await client.datasources.list();
  for (const ds of dsRes.data?.datasources ?? []) {
    if (ds.name?.startsWith(PREFIX) && ds.id) {
      const entriesRes = await client.datasourceEntries.list({
        query: { datasource_id: ds.id, per_page: 100 },
      });
      for (const entry of entriesRes.data?.datasource_entries ?? []) {
        if (entry.id) {
          await client.datasourceEntries.delete(entry.id);
        }
      }
      await client.datasources.delete(ds.id);
    }
  }
}

describe('schema + mapi-client MAPI round-trip', () => {
  let pageComponentId: number;
  let teaserComponentId: number;
  let sectionComponentId: number;
  let componentFolderId: number;
  let datasourceId: number;
  let internalTagId: number;
  let presetId: number;
  let storyId: number;

  beforeAll(async () => {
    await cleanup();

    // 1. Datasource + entries first — the page component schema references the datasource slug,
    //    and the MAPI validates that the datasource exists at component creation time.
    const datasourcePayload = defineDatasourceCreate({
      name: DATASOURCE_NAME,
      slug: DATASOURCE_SLUG,
    });
    const dsRes = await client.datasources.create({ body: { datasource: datasourcePayload } });
    datasourceId = dsRes.data!.datasource!.id!;

    for (const entry of [
      defineDatasourceEntryCreate({ name: 'Technology', value: 'tech', datasource_id: datasourceId }),
      defineDatasourceEntryCreate({ name: 'Design', value: 'design', datasource_id: datasourceId }),
      defineDatasourceEntryCreate({ name: 'Business', value: 'business', datasource_id: datasourceId }),
    ]) {
      await client.datasourceEntries.create({ body: { datasource_entry: entry } });
    }

    // 2. Component folder
    const folderPayload = defineBlockFolderCreate({ name: `${PREFIX}folder` });
    const folderRes = await client.componentFolders.create({ body: { component_group: folderPayload } });
    componentFolderId = folderRes.data!.component_group!.id!;
    const folderUuid = folderRes.data!.component_group!.uuid;

    // 3. Teaser component (innermost — whitelisted by section)
    const teaserPayload = defineBlockCreate({
      name: teaserComponent.name,
      schema: {
        title: { type: 'text', required: true, pos: 0 },
        image: { type: 'asset', pos: 1 },
      },
      component_group_uuid: folderUuid,
    });
    const teaserRes = await client.components.create({ body: { component: teaserPayload } });
    teaserComponentId = teaserRes.data!.component!.id!;

    // 4. Section component (level 2 — whitelists teaser, whitelisted by page)
    const sectionPayload = defineBlockCreate({
      name: sectionComponent.name,
      schema: {
        title: { type: 'text', pos: 0 },
        items: { type: 'bloks', component_whitelist: [teaserComponent.name], pos: 1 },
      },
      component_group_uuid: folderUuid,
    });
    const sectionRes = await client.components.create({ body: { component: sectionPayload } });
    sectionComponentId = sectionRes.data!.component!.id!;

    // 5. Page component (level 1 — whitelists both teaser and section in body)
    const pagePayload = defineBlockCreate({
      name: pageComponent.name,
      schema: {
        headline: { type: 'text', required: true, pos: 0 },
        rating: { type: 'number', pos: 1 },
        is_featured: { type: 'boolean', pos: 2 },
        description: { type: 'richtext', pos: 3 },
        body: { type: 'bloks', component_whitelist: [teaserComponent.name, sectionComponent.name], pos: 4 },
        category: { type: 'option', source: 'internal', datasource_slug: DATASOURCE_SLUG, pos: 5 },
        any_blocks: { type: 'bloks', pos: 6 },
      },
      component_group_uuid: folderUuid,
      is_root: true,
    });
    const pageRes = await client.components.create({ body: { component: pagePayload } });
    pageComponentId = pageRes.data!.component!.id!;

    // 5. Internal tag
    const tagPayload = defineInternalTagCreate({ name: `${PREFIX}tag`, object_type: 'component' });
    const tagRes = await client.internalTags.create({ body: { internal_tag: tagPayload } });
    internalTagId = tagRes.data!.internal_tag!.id!;

    // 6. Preset for page component
    const presetPayload = definePresetCreate({
      name: `${PREFIX}default_page`,
      component_id: pageComponentId,
      preset: { headline: 'Default Headline', rating: 0, is_featured: false },
      description: `Default preset for ${pageComponent.name}`,
    });
    const presetRes = await client.presets.create({ body: { preset: presetPayload } });
    presetId = presetRes.data!.preset!.id!;

    // 8. Story: body[0]=teaser (level 2), body[1]=section{items:[teaser]} (levels 2+3)
    const storyPayload = defineStoryCreate(pageComponent, {
      name: STORY_NAME,
      slug: STORY_SLUG,
      content: {
        headline: 'Hello from e2e',
        rating: 42,
        is_featured: true,
        description: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rich text body.' }] }],
        },
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
        category: 'tech',
        any_blocks: [
          {
            component: teaserComponent.name,
            title: 'Any Block Teaser',
          },
        ],
      },
    });
    const storyRes = await client.stories.create({ body: { story: storyPayload } });
    storyId = storyRes.data!.story!.id!;
  });

  afterAll(cleanup);

  describe('components', () => {
    it('should create page component with the correct name and schema keys', async () => {
      const res = await client.components.get(pageComponentId);
      const comp = res.data?.component;

      expect(comp).toBeDefined();
      expect(comp?.name).toBe(pageComponent.name);
      expect(comp?.schema).toMatchObject({
        headline: expect.objectContaining({ type: 'text' }),
        rating: expect.objectContaining({ type: 'number' }),
        is_featured: expect.objectContaining({ type: 'boolean' }),
        description: expect.objectContaining({ type: 'richtext' }),
        body: expect.objectContaining({ type: 'bloks' }),
        category: expect.objectContaining({ type: 'option' }),
      });
      expect(comp?.name).toBe(pageComponent.name);
    });

    it('should create teaser component with the correct schema', async () => {
      const res = await client.components.get(teaserComponentId);
      const comp = res.data?.component;

      expect(comp?.name).toBe(teaserComponent.name);
      expect(comp?.schema).toMatchObject({
        title: expect.objectContaining({ type: 'text', required: true }),
        image: expect.objectContaining({ type: 'asset' }),
      });
    });

    it('should create section component with the correct schema', async () => {
      const res = await client.components.get(sectionComponentId);
      const comp = res.data?.component;

      expect(comp?.name).toBe(sectionComponent.name);
      expect(comp?.schema).toMatchObject({
        title: expect.objectContaining({ type: 'text' }),
        items: expect.objectContaining({ type: 'bloks', component_whitelist: [teaserComponent.name] }),
      });
    });

    it('should assign components to the correct component folder', async () => {
      const folderRes = await client.componentFolders.get(componentFolderId);
      const folder = folderRes.data?.component_group;

      const pageRes = await client.components.get(pageComponentId);
      const comp = pageRes.data?.component;

      expect(folder?.name).toBe(`${PREFIX}folder`);
      expect(comp?.component_group_uuid).toBe(folder?.uuid);
    });

    it('should pass Zod componentSchema validation for raw API response, including per-field validation', async () => {
      const res = await client.components.get(pageComponentId);
      // componentSchema overrides the generated component.schema field with
      // z.record(fieldSchema), so each field entry is validated against the
      // discriminated field union — not just accepted as an open object.
      const result = componentSchema.safeParse(res.data?.component);
      expect(result.success).toBe(true);
    });
  });

  describe('datasources', () => {
    it('should create datasource with the correct name and slug', async () => {
      const res = await client.datasources.list();
      const ds = res.data?.datasources?.find(d => d.id === datasourceId);

      expect(ds).toBeDefined();
      expect(ds?.name).toBe(DATASOURCE_NAME);
      expect(ds?.slug).toBe(DATASOURCE_SLUG);
    });

    it('should create datasource entries with the correct names and values', async () => {
      const res = await client.datasourceEntries.list({
        query: { datasource_id: datasourceId, per_page: 100 },
      });
      const entries = res.data?.datasource_entries ?? [];

      expect(entries.length).toBeGreaterThanOrEqual(3);
      expect(entries.find(e => e.value === 'tech')?.name).toBe('Technology');
      expect(entries.find(e => e.value === 'design')?.name).toBe('Design');
      expect(entries.find(e => e.value === 'business')?.name).toBe('Business');
    });

    it('should pass Zod datasourceSchema validation for raw API response', async () => {
      const res = await client.datasources.list();
      const ds = res.data?.datasources?.find(d => d.id === datasourceId);
      const result = datasourceSchema.safeParse(ds);
      expect(result.success).toBe(true);
    });

    it('should pass Zod datasourceEntrySchema validation for each raw entry', async () => {
      const res = await client.datasourceEntries.list({
        query: { datasource_id: datasourceId, per_page: 100 },
      });
      for (const entry of res.data?.datasource_entries ?? []) {
        const result = datasourceEntrySchema.safeParse(entry);
        expect(result.success, JSON.stringify(result.error?.issues, null, 2)).toBe(true);
      }
    });
  });

  describe('internalTags', () => {
    it('should create and retrieve internal tag', async () => {
      const res = await client.internalTags.list();
      const tag = res.data?.internal_tags?.find(t => t.id === internalTagId);

      expect(tag).toBeDefined();
      expect(tag?.name).toBe(`${PREFIX}tag`);
      expect(tag?.object_type).toBe('component');
    });
  });

  describe('presets', () => {
    it('should create preset with the correct component_id and default values', async () => {
      const res = await client.presets.get(presetId);
      const preset = res.data?.preset;

      expect(preset).toBeDefined();
      expect(preset?.name).toBe(`${PREFIX}default_page`);
      expect(preset?.component_id).toBe(pageComponentId);
      expect(preset?.preset).toMatchObject({
        headline: 'Default Headline',
        rating: 0,
        is_featured: false,
      });
    });
  });

  describe('stories', () => {
    it('should match defined schema field types at runtime for story content', async () => {
      const res = await client.stories.get(storyId);
      const story = res.data?.story;

      expect(story).toBeDefined();
      expect(story?.name).toBe(STORY_NAME);
      expect(story?.slug).toBe(STORY_SLUG);

      // TypeScript narrows story.content to the pageComponent branch here.
      // Accessing story.content.headline etc. only compiles when the component guard passes,
      // so this block validates both runtime correctness and compile-time type narrowing.
      if (story?.content?.component === pageComponent.name) {
        expect(typeof story.content.headline).toBe('string');
        expect(story.content.headline).toBe('Hello from e2e');

        expect(typeof story.content.rating).toBe('number');
        expect(story.content.rating).toBe(42);

        expect(typeof story.content.is_featured).toBe('boolean');
        expect(story.content.is_featured).toBe(true);

        expect(story.content.description).toMatchObject({ type: 'doc' });

        expect(Array.isArray(story.content.body)).toBe(true);
        expect(story.content.body.length).toBeGreaterThan(0);

        expect(typeof story.content.category).toBe('string');
        expect(story.content.category).toBe('tech');
      }
      else {
        throw new Error(
          `Expected story.content.component to be '${pageComponent.name}', got '${story?.content?.component}'`,
        );
      }
    });

    it('should have correct structure for nested teaser blok (two levels: page → teaser)', async () => {
      const res = await client.stories.get(storyId);
      const story = res.data?.story;

      if (story?.content?.component !== pageComponent.name) {
        throw new Error('Unexpected component discriminant');
      }

      const teaser = story.content.body[0];

      expect(teaser).toBeDefined();
      expect(teaser?.component).toBe(teaserComponent.name);
      expect(typeof teaser?.title).toBe('string');
      expect(teaser?.title).toBe('Teaser Title');
    });

    it('should resolve correct types for three-level nested blok (page → section → teaser)', async () => {
      const res = await client.stories.get(storyId);
      const story = res.data?.story;

      if (story?.content?.component !== pageComponent.name) {
        throw new Error('Unexpected component discriminant at level 1');
      }

      // Level 2: narrow body[1] to section
      const section = story.content.body[1];
      if (section?.component === sectionComponent.name) {
        expect(typeof section.title).toBe('string');
        expect(section.title).toBe('Section Title');
        expect(Array.isArray(section.items)).toBe(true);
        expect(section.items.length).toBeGreaterThan(0);

        // Level 3: section.items[0] is a typed teaser — not `never`
        const nestedTeaser = section.items[0];
        if (nestedTeaser?.component === teaserComponent.name) {
          expect(typeof nestedTeaser.title).toBe('string');
          expect(nestedTeaser.title).toBe('Nested Teaser Title');
        }
        else {
          throw new Error(`Expected items[0].component to be '${teaserComponent.name}', got '${nestedTeaser?.component}'`);
        }
      }
      else {
        throw new Error(`Expected body[1].component to be '${sectionComponent.name}', got '${section?.component}'`);
      }
    });

    it('should resolve all schema component types for bloks field without whitelist', async () => {
      const res = await client.stories.get(storyId);
      const story = res.data?.story;

      if (story?.content?.component !== pageComponent.name) {
        throw new Error('Unexpected component discriminant');
      }

      // any_blocks has no component_whitelist — TypeScript resolves items to the full
      // schema union (page | teaser | section), not `never` and not a generic block
      // with only component: string. Accessing blok.title after narrowing to the
      // teaser discriminant proves the discriminated union is correctly typed.
      const blok = story.content.any_blocks[0];
      if (blok?.component === teaserComponent.name) {
        expect(typeof blok.title).toBe('string');
        expect(blok.title).toBe('Any Block Teaser');
      }
      else {
        throw new Error(`Expected any_blocks[0].component to be '${teaserComponent.name}', got '${blok?.component}'`);
      }
    });

    it('should round-trip story update correctly', async () => {
      const updatedPayload = defineStoryUpdate(pageComponent, {
        name: `${STORY_NAME} (Updated)`,
        slug: STORY_SLUG,
        content: {
          headline: 'Updated headline',
          rating: 100,
          is_featured: false,
          description: {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Updated.' }] }],
          },
          body: [],
          category: 'design',
          any_blocks: [],
        },
      });

      await client.stories.update(storyId, { body: { story: updatedPayload } });

      const res = await client.stories.get(storyId);
      const story = res.data?.story;

      if (story?.content?.component !== pageComponent.name) {
        throw new Error('Unexpected component discriminant after update');
      }

      expect(story.content.headline).toBe('Updated headline');
      expect(story.content.rating).toBe(100);
      expect(story.content.is_featured).toBe(false);
      expect(story.content.category).toBe('design');
    });

    it('should pass Zod MAPI story schema validation for raw API response', async () => {
      const res = await client.stories.get(storyId);
      // MAPI stories include extra fields (breadcrumbs, stage, last_author, etc.)
      // not present in the CAPI story schema, so we use the MAPI Zod entry point here.
      const result = storySchema.safeParse(res.data?.story);
      expect(result.success).toBe(true);
    });
  });
});
