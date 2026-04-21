import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { join } from 'pathe';
import { vol } from 'memfs';
import type { Story } from './constants';
import type { ComponentSchemas } from './ref-mapper';
import {
  collectSchemaIssues,
  formatSchemaIssues,
  hasSchemaIssues,
  validateStoryAgainstSchemas,
} from './validate-story';
import { makeStoryWithAllFieldTypes, pageWithEverythingBlok } from './__tests__/story-with-all-field-types';

const makeStory = (content: Record<string, unknown>): Story => ({
  name: 'Test',
  id: 1,
  uuid: randomUUID(),
  parent_id: 0,
  is_folder: false,
  slug: 'test',
  content,
} as unknown as Story);

describe('validateStoryAgainstSchemas', () => {
  it('should return empty sets when content matches schema', () => {
    const schemas: ComponentSchemas = {
      page: {
        headline: { type: 'text' },
        body: { type: 'textarea' },
      } as never,
    };
    const story = makeStory({
      _uid: randomUUID(),
      component: 'page',
      headline: 'Hi',
      body: 'Lorem',
    });

    const { driftByComponent, missingSchemas } = validateStoryAgainstSchemas(story, schemas);

    expect(driftByComponent.size).toBe(0);
    expect(missingSchemas.size).toBe(0);
  });

  it('should ignore reserved keys (_uid, _editable, _shared, component)', () => {
    const schemas: ComponentSchemas = {
      page: {} as never,
    };
    const story = makeStory({
      _uid: randomUUID(),
      _editable: '<!--#storyblok#-->',
      _shared: 'shared-id',
      _isolated: false,
      _locked: false,
      component: 'page',
    });

    const { driftByComponent, missingSchemas } = validateStoryAgainstSchemas(story, schemas);

    expect(driftByComponent.size).toBe(0);
    expect(missingSchemas.size).toBe(0);
  });

  it('should report root-level fields not declared in schema', () => {
    const schemas: ComponentSchemas = {
      page: {
        headline: { type: 'text' },
      } as never,
    };
    const story = makeStory({
      _uid: randomUUID(),
      component: 'page',
      headline: 'Hi',
      color: '#ff0000',
    });

    const { driftByComponent, missingSchemas } = validateStoryAgainstSchemas(story, schemas);

    expect(driftByComponent.get('page')).toEqual(new Set(['color']));
    expect(driftByComponent.size).toBe(1);
    expect(missingSchemas.size).toBe(0);
  });

  it('should report every undeclared field on a single component', () => {
    const schemas: ComponentSchemas = {
      page: {
        headline: { type: 'text' },
      } as never,
    };
    const story = makeStory({
      _uid: randomUUID(),
      component: 'page',
      headline: 'Hi',
      color: '#ff0000',
      extra: 'something',
    });

    const { driftByComponent } = validateStoryAgainstSchemas(story, schemas);

    expect(driftByComponent.get('page')).toEqual(new Set(['color', 'extra']));
    expect(driftByComponent.size).toBe(1);
  });

  it('should report plugin-shaped drift (value is an object carrying a `plugin` property)', () => {
    const schemas: ComponentSchemas = {
      page: {
        headline: { type: 'text' },
      } as never,
    };
    const story = makeStory({
      _uid: randomUUID(),
      component: 'page',
      headline: 'Hi',
      color: {
        _uid: randomUUID(),
        plugin: 'official-colorpicker',
        color: '#4c1130',
      },
    });

    const { driftByComponent } = validateStoryAgainstSchemas(story, schemas);

    expect(driftByComponent.get('page')).toEqual(new Set(['color']));
    expect(driftByComponent.size).toBe(1);
  });

  it('should report drift inside a declared `bloks` field', () => {
    const schemas: ComponentSchemas = {
      page: {
        body: { type: 'bloks' },
      } as never,
      hero: {
        title: { type: 'text' },
      } as never,
    };
    const story = makeStory({
      _uid: randomUUID(),
      component: 'page',
      body: [
        {
          _uid: randomUUID(),
          component: 'hero',
          title: 'Hello',
          bg_color: '#ff0000',
        },
      ],
    });

    const { driftByComponent } = validateStoryAgainstSchemas(story, schemas);

    expect(driftByComponent.get('hero')).toEqual(new Set(['bg_color']));
    expect(driftByComponent.size).toBe(1);
  });

  it('should dedupe drift across repeated instances of the same blok', () => {
    const schemas: ComponentSchemas = {
      page: { body: { type: 'bloks' } } as never,
      hero: { title: { type: 'text' } } as never,
    };
    const story = makeStory({
      _uid: randomUUID(),
      component: 'page',
      body: [
        { _uid: randomUUID(), component: 'hero', title: 'A', bg_color: '#fff' },
        { _uid: randomUUID(), component: 'hero', title: 'B', bg_color: '#000' },
        { _uid: randomUUID(), component: 'hero', title: 'C', bg_color: '#abc' },
      ],
    });

    const { driftByComponent } = validateStoryAgainstSchemas(story, schemas);

    expect(driftByComponent.get('hero')).toEqual(new Set(['bg_color']));
    expect(driftByComponent.size).toBe(1);
  });

  it('should report drift two levels deep in nested bloks', () => {
    const schemas: ComponentSchemas = {
      page: { body: { type: 'bloks' } } as never,
      section: { items: { type: 'bloks' } } as never,
      card: { title: { type: 'text' } } as never,
    };
    const story = makeStory({
      _uid: randomUUID(),
      component: 'page',
      body: [
        {
          _uid: randomUUID(),
          component: 'section',
          items: [
            {
              _uid: randomUUID(),
              component: 'card',
              title: 'Ok',
              unknown_field: 'drift',
            },
          ],
        },
      ],
    });

    const { driftByComponent } = validateStoryAgainstSchemas(story, schemas);

    expect(driftByComponent.get('card')).toEqual(new Set(['unknown_field']));
    expect(driftByComponent.size).toBe(1);
  });

  it('should report drift inside a blok embedded in a richtext field', () => {
    const schemas: ComponentSchemas = {
      page: { rt: { type: 'richtext' } } as never,
      hero: { title: { type: 'text' } } as never,
    };
    const story = makeStory({
      _uid: randomUUID(),
      component: 'page',
      rt: {
        type: 'doc',
        content: [
          {
            type: 'blok',
            attrs: {
              id: randomUUID(),
              body: [
                {
                  _uid: randomUUID(),
                  component: 'hero',
                  title: 'Ok',
                  undeclared: 42,
                },
              ],
            },
          },
        ],
      },
    });

    const { driftByComponent } = validateStoryAgainstSchemas(story, schemas);

    expect(driftByComponent.get('hero')).toEqual(new Set(['undeclared']));
    expect(driftByComponent.size).toBe(1);
  });

  it('should report the missing component when content references an unknown schema', () => {
    const schemas: ComponentSchemas = {};
    const story = makeStory({
      _uid: randomUUID(),
      component: 'unknown',
      anything: 'goes',
    });

    const { driftByComponent, missingSchemas } = validateStoryAgainstSchemas(story, schemas);

    expect(Array.from(missingSchemas)).toEqual(['unknown']);
    expect(driftByComponent.size).toBe(0);
  });

  it('should record a missing nested component but keep validating its siblings', () => {
    const schemas: ComponentSchemas = {
      page: { body: { type: 'bloks' } } as never,
      hero: { title: { type: 'text' } } as never,
    };
    const story = makeStory({
      _uid: randomUUID(),
      component: 'page',
      body: [
        {
          _uid: randomUUID(),
          component: 'unknown_block',
          title: 'ignored',
        },
        {
          _uid: randomUUID(),
          component: 'hero',
          title: 'Ok',
          undeclared: true,
        },
      ],
    });

    const { driftByComponent, missingSchemas } = validateStoryAgainstSchemas(story, schemas);

    expect(Array.from(missingSchemas)).toEqual(['unknown_block']);
    expect(driftByComponent.get('hero')).toEqual(new Set(['undeclared']));
    expect(driftByComponent.size).toBe(1);
  });

  it('should normalize the __i18n__ suffix when looking up fields', () => {
    const schemas: ComponentSchemas = {
      page: {
        headline: { type: 'text' },
      } as never,
    };
    const story = makeStory({
      _uid: randomUUID(),
      component: 'page',
      headline: 'Hello',
      headline__i18n__de: 'Hallo',
      color__i18n__de: '#4c1130',
    });

    const { driftByComponent } = validateStoryAgainstSchemas(story, schemas);

    expect(driftByComponent.get('page')).toEqual(new Set(['color']));
    expect(driftByComponent.size).toBe(1);
  });

  it('should skip content without a component field', () => {
    const schemas: ComponentSchemas = {};
    const story = makeStory({ headline: 'Hi' });

    const { driftByComponent, missingSchemas } = validateStoryAgainstSchemas(story, schemas);

    expect(driftByComponent.size).toBe(0);
    expect(missingSchemas.size).toBe(0);
  });

  it('should not crash or report drift for null or undefined field values', () => {
    const schemas: ComponentSchemas = {
      page: {
        body: { type: 'bloks' },
        headline: { type: 'text' },
      } as never,
    };
    const story = makeStory({
      _uid: randomUUID(),
      component: 'page',
      body: null,
      headline: undefined,
    });

    const { driftByComponent, missingSchemas } = validateStoryAgainstSchemas(story, schemas);

    expect(driftByComponent.size).toBe(0);
    expect(missingSchemas.size).toBe(0);
  });

  it('should validate every sibling when one of them has drift', () => {
    const schemas: ComponentSchemas = {
      page: { body: { type: 'bloks' } } as never,
      hero: { title: { type: 'text' } } as never,
      cta: { label: { type: 'text' } } as never,
    };
    const story = makeStory({
      _uid: randomUUID(),
      component: 'page',
      body: [
        { _uid: randomUUID(), component: 'hero', title: 'A', stray: 1 },
        { _uid: randomUUID(), component: 'cta', label: 'B', extra: 2 },
      ],
    });

    const { driftByComponent } = validateStoryAgainstSchemas(story, schemas);

    expect(driftByComponent.get('hero')).toEqual(new Set(['stray']));
    expect(driftByComponent.get('cta')).toEqual(new Set(['extra']));
    expect(driftByComponent.size).toBe(2);
  });

  it('should report zero issues for the realistic makeStoryWithAllFieldTypes fixture', () => {
    const schemas: ComponentSchemas = {
      page_with_everything: pageWithEverythingBlok.schema as never,
    };
    const story = makeStoryWithAllFieldTypes() as unknown as Story;

    const { driftByComponent, missingSchemas } = validateStoryAgainstSchemas(story, schemas);

    expect(driftByComponent.size).toBe(0);
    expect(missingSchemas.size).toBe(0);
  });
});

describe('collectSchemaIssues', () => {
  afterEach(() => { vol.reset(); });

  const writeStory = (dir: string, story: Story) => {
    vol.fromJSON({ [join(dir, `${story.slug}_${story.uuid}.json`)]: JSON.stringify(story) });
  };

  it('should return zeroed issues when no story files exist', async () => {
    const issues = await collectSchemaIssues({ directoryPath: '/nowhere', schemas: {} });

    expect(issues.total).toBe(0);
    expect(issues.driftByComponent.size).toBe(0);
    expect(issues.missingSchemas.size).toBe(0);
  });

  it('should aggregate drift and missing schemas across every story in the directory', async () => {
    const directoryPath = '/stories';
    const schemas: ComponentSchemas = {
      page: { headline: { type: 'text' } } as never,
    };
    const driftStory: Story = {
      name: 'Drift',
      id: 1,
      uuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      parent_id: 0,
      is_folder: false,
      slug: 'drift',
      content: {
        _uid: randomUUID(),
        component: 'page',
        headline: 'Hi',
        color: '#4c1130',
      },
    } as unknown as Story;
    const missingStory: Story = {
      name: 'Missing',
      id: 2,
      uuid: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      parent_id: 0,
      is_folder: false,
      slug: 'missing',
      content: { _uid: randomUUID(), component: 'article' },
    } as unknown as Story;
    writeStory(directoryPath, driftStory);
    writeStory(directoryPath, missingStory);

    const issues = await collectSchemaIssues({ directoryPath, schemas });

    expect(issues.total).toBe(2);
    expect(issues.missingSchemas.get('article')).toEqual(new Set(['missing']));
    expect(issues.driftByComponent.get('page')?.get('color')).toEqual(new Set(['drift']));
  });

  it('should dedupe drift and missing across many stories', async () => {
    const directoryPath = '/stories';
    const schemas: ComponentSchemas = {
      page: { headline: { type: 'text' } } as never,
    };
    for (let i = 0; i < 3; i += 1) {
      const story: Story = {
        name: `Story ${i}`,
        id: i,
        uuid: `${i}${i}${i}${i}${i}${i}${i}${i}-${i}${i}${i}${i}-${i}${i}${i}${i}-${i}${i}${i}${i}-${i}${i}${i}${i}${i}${i}${i}${i}${i}${i}${i}${i}`,
        parent_id: 0,
        is_folder: false,
        slug: `story-${i}`,
        content: { _uid: randomUUID(), component: 'page', color: '#fff' },
      } as unknown as Story;
      writeStory(directoryPath, story);
    }

    const issues = await collectSchemaIssues({ directoryPath, schemas });

    expect(issues.total).toBe(3);
    const drift = issues.driftByComponent.get('page')?.get('color');
    expect(drift).toEqual(new Set(['story-0', 'story-1', 'story-2']));
  });
});

describe('formatSchemaIssues', () => {
  it('should render both sections with alphabetically sorted entries and story lists', () => {
    const driftByComponent = new Map<string, Map<string, Set<string>>>([
      ['page', new Map([
        ['color', new Set(['home/landing'])],
        ['another', new Set(['home/about'])],
      ])],
      ['article', new Map([
        ['leftover', new Set(['blog/first'])],
        ['orphan', new Set(['blog/second', 'blog/first'])],
      ])],
    ]);
    const missingSchemas = new Map<string, Set<string>>([
      ['zz_missing', new Set(['home/index'])],
      ['aa_missing', new Set(['home/about'])],
    ]);

    const message = formatSchemaIssues({
      driftByComponent,
      missingSchemas,
      total: 5,
    });

    expect(message).toContain('Schema validation failed. Push aborted.');
    expect(message).toContain('Missing component schemas:');
    expect(message).toContain('- aa_missing (in stories: home/about)');
    expect(message).toContain('- zz_missing (in stories: home/index)');
    expect(message).toContain('Fields not declared in local schemas:');
    expect(message).toContain('- article.leftover (in stories: blog/first)');
    expect(message).toContain('- article.orphan (in stories: blog/first, blog/second)');
    expect(message).toContain('- page.another (in stories: home/about)');
    expect(message).toContain('- page.color (in stories: home/landing)');
    // Different remedies for each section
    expect(message).toContain('If these components exist in Storyblok, run `storyblok components pull` to sync them locally.');
    expect(message).toContain('Otherwise, create them in Storyblok first, or remove the references from the affected stories.');
    expect(message).toContain('These fields will be lost when the stories are pushed. To fix, either:');
    expect(message).toContain('Add the field to the component in Storyblok, then run `storyblok components pull`');
    expect(message).toContain('Or remove the field from the affected story JSON files');
    // Missing section appears before drift section
    expect(message.indexOf('Missing component schemas')).toBeLessThan(message.indexOf('Fields not declared'));
    // Alphabetical ordering of components
    expect(message.indexOf('- aa_missing')).toBeLessThan(message.indexOf('- zz_missing'));
    expect(message.indexOf('- article')).toBeLessThan(message.indexOf('- page'));
  });

  it('should omit the drift section when no fields drifted', () => {
    const message = formatSchemaIssues({
      driftByComponent: new Map(),
      missingSchemas: new Map([['foo', new Set(['home'])]]),
      total: 1,
    });

    expect(message).toContain('- foo (in stories: home)');
    expect(message).not.toContain('Fields not declared');
    expect(message).not.toContain('These fields will be lost');
  });

  it('should omit the missing section when no components are missing', () => {
    const message = formatSchemaIssues({
      driftByComponent: new Map([['page', new Map([['color', new Set(['home'])]])]]),
      missingSchemas: new Map(),
      total: 1,
    });

    expect(message).not.toContain('Missing component schemas');
    expect(message).toContain('- page.color (in stories: home)');
  });

  it('should truncate long story lists with a summary count', () => {
    const stories = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    const message = formatSchemaIssues({
      driftByComponent: new Map([['page', new Map([['color', stories]])]]),
      missingSchemas: new Map(),
      total: 7,
    });

    expect(message).toContain('(in stories: a, b, c, d, e, and 2 more)');
  });
});

describe('hasSchemaIssues', () => {
  it('should return false when both drift and missing sets are empty', () => {
    expect(hasSchemaIssues({ driftByComponent: new Map(), missingSchemas: new Map(), total: 3 })).toBe(false);
  });

  it('should return true when any component has drift fields', () => {
    expect(hasSchemaIssues({
      driftByComponent: new Map([['page', new Map([['color', new Set(['home'])]])]]),
      missingSchemas: new Map(),
      total: 1,
    })).toBe(true);
  });

  it('should return true when any component schema is missing', () => {
    expect(hasSchemaIssues({
      driftByComponent: new Map(),
      missingSchemas: new Map([['foo', new Set(['home'])]]),
      total: 1,
    })).toBe(true);
  });
});
