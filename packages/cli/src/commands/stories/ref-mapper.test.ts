import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { makeStoryWithAllFieldTypes, pageWithEverythingBlok } from './__test__/story-with-all-field-types';
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
    const assetMap = new Map<number | string, number | string>();
    // Bloks > multilink
    storyMap.set(story.content.bloks[0].link.id, randomUUID());
    // Bloks > richtext > link
    storyMap.set(story.content.bloks[0].richtext.content[0].content[0].marks[0].attrs.uuid, randomUUID());
    // Bloks > bloks > richtext > link
    storyMap.set(story.content.bloks[0].bloks[0].richtext.content[0].content[0].content[0].content[0].marks[0].attrs.uuid, randomUUID());
    storyMap.set(story.content.bloks[0].bloks[0].richtext__i18n__de.content[0].content[0].content[0].content[0].marks[0].attrs.uuid, randomUUID());
    // Bloks > bloks > asset
    assetMap.set(story.content.bloks[0].bloks[0].asset.id, getID());
    assetMap.set(story.content.bloks[0].bloks[0].asset.filename, 'https://a.storyblok.com/f/12345/500x500/new-filename.png');
    // Richtext
    storyMap.set(story.content.richtext.content[0].content[0].marks[0].attrs.uuid, randomUUID());
    storyMap.set(story.content.richtext.content[1].attrs.body[0].link.id, randomUUID());
    // Options
    story.content.references.forEach(r => storyMap.set(r, randomUUID()));
    // Multilink
    storyMap.set(story.content.link.id, randomUUID());
    // Asset
    assetMap.set(story.content.asset.id, getID());
    assetMap.set(story.content.asset.filename, 'https://a.storyblok.com/f/12345/500x500/new-filename.png');
    // Multiasset
    assetMap.set(story.content.multi_assets[0].id, getID());
    assetMap.set(story.content.multi_assets[0].filename, 'https://a.storyblok.com/f/12345/500x500/new-filename.png');
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
    expect(mappedStory.content.bloks[0].bloks[0].asset.id).toBe(assetMap.get(story.content.bloks[0].bloks[0].asset.id));
    expect(mappedStory.content.bloks[0].bloks[0].asset.filename).toBe(assetMap.get(story.content.bloks[0].bloks[0].asset.filename));
    // Richtext
    expect(mappedStory.content.richtext.content[0].content[0].marks[0].attrs.uuid).toBe(storyMap.get(story.content.richtext.content[0].content[0].marks[0].attrs.uuid));
    expect(mappedStory.content.richtext.content[1].attrs.body[0].link.id).toBe(storyMap.get(story.content.richtext.content[1].attrs.body[0].link.id));
    // Options
    expect(mappedStory.content.references).toEqual(story.content.references.map(r => storyMap.get(r)));
    // Multilink
    expect(mappedStory.content.link.id).toBe(storyMap.get(story.content.link.id));
    // Asset
    expect(mappedStory.content.asset.id).toBe(assetMap.get(story.content.asset.id));
    expect(mappedStory.content.asset.filename).toBe(assetMap.get(story.content.asset.filename));
    // Multiasset
    expect(mappedStory.content.multi_assets[0].id).toBe(assetMap.get(story.content.multi_assets[0].id));
    expect(mappedStory.content.multi_assets[0].filename).toBe(assetMap.get(story.content.multi_assets[0].filename));
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
});
