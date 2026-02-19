import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { makeStoryWithAllFieldTypes, pageWithEverythingBlok } from './__tests__/story-with-all-field-types';
import { storyRefMapper } from './ref-mapper';

const componentSchemas = {
  page_with_everything: pageWithEverythingBlok.schema,
} as const;

let id = 1000;
const getID = () => {
  id += 1;
  return id;
};

describe('storyRefMapper', () => {
  it('should map all relevant IDs on a story', () => {
    const story = makeStoryWithAllFieldTypes();
    const storyMap = new Map<number | string, number | string>();
    storyMap.set(story.id, 1000);
    storyMap.set(story.uuid, randomUUID());
    storyMap.set(story.parent_id, 1100);
    storyMap.set(story.alternates[0].id, randomUUID());
    storyMap.set(story.alternates[0].parent_id, randomUUID());
    const maps = { assets: new Map(), stories: storyMap };

    // @ts-expect-error Our types are wrong.
    const { mappedStory } = storyRefMapper(story, { schemas: componentSchemas, maps });

    expect(mappedStory.id).toBe(storyMap.get(story.id));
    expect(mappedStory.uuid).toBe(storyMap.get(story.uuid));
    expect(mappedStory.parent_id).toBe(storyMap.get(story.parent_id));
    expect(mappedStory.alternates?.[0].id).toBe(storyMap.get(story.alternates[0].id));
    expect(mappedStory.alternates?.[0].parent_id).toBe(storyMap.get(story.alternates[0].parent_id));
  });

  it('should map all relevant IDs in all of the fields of a story', () => {
    const story = makeStoryWithAllFieldTypes();
    const storyMap = new Map<number | string, number | string>();
    const assetMap = new Map<number, any>();
    // Bloks > multilink
    storyMap.set(story.content.bloks[0].link.id, randomUUID());
    // Bloks > richtext > link
    storyMap.set(story.content.bloks[0].richtext.content[0].content[0].marks[0].attrs.uuid, randomUUID());
    // Bloks > bloks > richtext > link
    storyMap.set(story.content.bloks[0].bloks[0].richtext.content[0].content[0].content[0].content[0].marks[0].attrs.uuid, randomUUID());
    storyMap.set(story.content.bloks[0].bloks[0].richtext__i18n__de.content[0].content[0].content[0].content[0].marks[0].attrs.uuid, randomUUID());
    // Bloks > bloks > asset
    const asset1New = { id: getID(), filename: 'https://a.storyblok.com/f/12345/500x500/new-filename.png' };
    assetMap.set(story.content.bloks[0].bloks[0].asset.id, { new: asset1New });
    // Richtext
    storyMap.set(story.content.richtext.content[0].content[0].marks[0].attrs.uuid, randomUUID());
    storyMap.set(story.content.richtext.content[1].attrs.body[0].link.id, randomUUID());
    // Options
    story.content.references.forEach(r => storyMap.set(r, randomUUID()));
    // Multilink
    storyMap.set(story.content.link.id, randomUUID());
    // Asset
    const asset2New = {
      id: getID(),
      filename: 'https://a.storyblok.com/f/12345/500x500/new-filename.png',
      meta_data: { alt: 'New Alt' },
    };
    assetMap.set(story.content.asset.id, { new: asset2New });
    // Multiasset
    const asset3New = { id: getID(), filename: 'https://a.storyblok.com/f/12345/500x500/new-filename.png' };
    assetMap.set(story.content.multi_assets[0].id, { new: asset3New });
    const maps = { assets: assetMap, stories: storyMap };

    // @ts-expect-error Our types are wrong.
    const { mappedStory } = storyRefMapper(story, { schemas: componentSchemas, maps });

    // Bloks > multilink
    expect(mappedStory.content.bloks[0].link.id).toBe(storyMap.get(story.content.bloks[0].link.id));
    // Bloks > richtext > link
    expect(mappedStory.content.bloks[0].richtext.content[0].content[0].marks[0].attrs.uuid).toBe(storyMap.get(story.content.bloks[0].richtext.content[0].content[0].marks[0].attrs.uuid));
    // Bloks > bloks > richtext > link
    expect(mappedStory.content.bloks[0].bloks[0].richtext.content[0].content[0].content[0].content[0].marks[0].attrs.uuid).toBe(storyMap.get(story.content.bloks[0].bloks[0].richtext.content[0].content[0].content[0].content[0].marks[0].attrs.uuid));
    // Bloks > bloks > richtext > link (i18n)
    expect(mappedStory.content.bloks[0].bloks[0].richtext__i18n__de.content[0].content[0].content[0].content[0].marks[0].attrs.uuid).toBe(storyMap.get(story.content.bloks[0].bloks[0].richtext__i18n__de.content[0].content[0].content[0].content[0].marks[0].attrs.uuid));
    // Bloks > bloks > asset
    expect(mappedStory.content.bloks[0].bloks[0].asset.id).toBe(asset1New.id);
    expect(mappedStory.content.bloks[0].bloks[0].asset.filename).toBe(asset1New.filename);
    // Richtext
    expect(mappedStory.content.richtext.content[0].content[0].marks[0].attrs.uuid).toBe(storyMap.get(story.content.richtext.content[0].content[0].marks[0].attrs.uuid));
    expect(mappedStory.content.richtext.content[1].attrs.body[0].link.id).toBe(storyMap.get(story.content.richtext.content[1].attrs.body[0].link.id));
    // Options
    expect(mappedStory.content.references).toEqual(story.content.references.map(r => storyMap.get(r)));
    // Multilink
    expect(mappedStory.content.link.id).toBe(storyMap.get(story.content.link.id));
    // Asset
    expect(mappedStory.content.asset.id).toBe(asset2New.id);
    expect(mappedStory.content.asset.filename).toBe(asset2New.filename);
    expect(mappedStory.content.asset.meta_data.alt).toBe(asset2New.meta_data.alt);
    // Multiasset
    expect(mappedStory.content.multi_assets[0].id).toBe(asset3New.id);
    expect(mappedStory.content.multi_assets[0].filename).toBe(asset3New.filename);
  });

  it('should track all the components it processed', () => {
    const story = makeStoryWithAllFieldTypes();
    const maps = { assets: new Map(), stories: new Map() };

    // @ts-expect-error Our types are wrong.
    const { processedFields } = storyRefMapper(story, { schemas: componentSchemas, maps });

    expect(Array.from(processedFields)).toEqual([
      expect.objectContaining({ type: 'datetime' }),
      expect.objectContaining({ type: 'multilink' }),
      expect.objectContaining({ type: 'text' }),
      expect.objectContaining({ type: 'asset' }),
      expect.objectContaining({ type: 'table' }),
      expect.objectContaining({ type: 'bloks' }),
      expect.objectContaining({ type: 'number' }),
      expect.objectContaining({ type: 'custom' }),
      expect.objectContaining({ type: 'boolean' }),
      expect.objectContaining({ type: 'markdown' }),
      expect.objectContaining({ type: 'richtext' }),
      expect.objectContaining({ type: 'textarea' }),
      expect.objectContaining({ type: 'options' }),
      expect.objectContaining({ type: 'multiasset' }),
      expect.objectContaining({ type: 'options' }),
      expect.objectContaining({ type: 'option' }),
    ]);
  });

  it('should track missing component schemas', () => {
    const story = makeStoryWithAllFieldTypes();
    const maps = { assets: new Map(), stories: new Map() };
    const schemasWithoutPage = {};

    // @ts-expect-error Our types are wrong.
    const { missingSchemas } = storyRefMapper(story, { schemas: schemasWithoutPage, maps });

    expect(Array.from(missingSchemas)).toEqual(['page_with_everything']);
  });

  it('should preserve parent_id of 0 instead of converting it to null', () => {
    const story = {
      name: 'Root Story',
      id: getID(),
      uuid: randomUUID(),
      parent_id: 0,
      is_folder: false,
      slug: 'root-story',
      content: { _uid: randomUUID(), component: 'page_with_everything' },
    };
    const maps = { assets: new Map(), stories: new Map() };

    // @ts-expect-error Our types are wrong.
    const { mappedStory } = storyRefMapper(story, { schemas: componentSchemas, maps });

    expect(mappedStory.parent_id).toBe(0);
  });

  it('should handle stories with missing content field', () => {
    const story = {
      name: 'No Content Story',
      id: getID(),
      uuid: randomUUID(),
      parent_id: null,
      is_folder: false,
      slug: 'no-content',
    };
    const maps = { assets: new Map(), stories: new Map() };

    // @ts-expect-error Our types are wrong.
    const { mappedStory } = storyRefMapper(story, { schemas: componentSchemas, maps });

    expect(mappedStory.content).toBeUndefined();
    expect(mappedStory.id).toBe(story.id);
    expect(mappedStory.uuid).toBe(story.uuid);
  });

  it('should handle stories with content lacking a component field', () => {
    const story = {
      name: 'Folder',
      id: getID(),
      uuid: randomUUID(),
      parent_id: null,
      is_folder: true,
      slug: 'folder',
      content: { _uid: randomUUID() },
    };
    const maps = { assets: new Map(), stories: new Map() };

    // @ts-expect-error Our types are wrong.
    const { mappedStory, missingSchemas } = storyRefMapper(story, { schemas: componentSchemas, maps });

    expect(mappedStory.content).toEqual(story.content);
    expect(Array.from(missingSchemas)).toEqual([]);
  });

  it('should handle richtext with missing attrs on link nodes', () => {
    const story = {
      name: 'Richtext Story',
      id: getID(),
      uuid: randomUUID(),
      parent_id: null,
      is_folder: false,
      slug: 'richtext-story',
      content: {
        _uid: randomUUID(),
        component: 'page_with_everything',
        richtext: {
          type: 'doc',
          content: [
            { type: 'link' },
          ],
        },
      },
    };
    const maps = { assets: new Map(), stories: new Map() };

    // @ts-expect-error Our types are wrong.
    expect(() => storyRefMapper(story, { schemas: componentSchemas, maps })).not.toThrow();
  });

  it('should handle richtext blok nodes with missing attrs or body', () => {
    const story = {
      name: 'Blok Story',
      id: getID(),
      uuid: randomUUID(),
      parent_id: null,
      is_folder: false,
      slug: 'blok-story',
      content: {
        _uid: randomUUID(),
        component: 'page_with_everything',
        richtext: {
          type: 'doc',
          content: [
            { type: 'blok' },
            { type: 'blok', attrs: {} },
          ],
        },
      },
    };
    const maps = { assets: new Map(), stories: new Map() };

    // @ts-expect-error Our types are wrong.
    expect(() => storyRefMapper(story, { schemas: componentSchemas, maps })).not.toThrow();
  });
});
