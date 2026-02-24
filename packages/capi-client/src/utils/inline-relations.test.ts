import { describe, expect, it } from 'vitest';
import type { StoryCapi } from '../generated/stories';
import {
  buildRelationMap,
  inlineStoriesContent,
  inlineStoryContent,
  parseResolveRelations,
} from './inline-relations';

let storyId = 1;

const makeStory = (
  uuid: string,
  content: StoryCapi['content'],
  overrides: Partial<StoryCapi> = {},
): StoryCapi => {
  return {
    alternates: [],
    content,
    created_at: '2024-01-01T00:00:00.000Z',
    default_full_slug: `default/${uuid}`,
    first_published_at: '2024-01-01T00:00:00.000Z',
    full_slug: `stories/${uuid}`,
    group_id: `group-${uuid}`,
    id: storyId++,
    is_startpage: false,
    lang: 'default',
    name: `Story ${uuid}`,
    parent_id: 0,
    path: `stories/${uuid}`,
    position: 0,
    published_at: '2024-01-01T00:00:00.000Z',
    release_id: 0,
    slug: uuid,
    sort_by_date: '2024-01-01',
    tag_list: [],
    translated_slugs: [],
    updated_at: '2024-01-01T00:00:00.000Z',
    uuid,
    ...overrides,
  };
};

describe('parseResolveRelations', () => {
  it('should parse resolve_relations entries', () => {
    const relationPaths = parseResolveRelations({
      resolve_relations: 'page.author, page.categories, invalid-entry, page.',
    });

    expect(relationPaths).toEqual(['page.author', 'page.categories']);
  });
});

describe('inlineStoryContent', () => {
  it('should inline nested relations and prevent cycles', () => {
    const storyA = makeStory('story-a', {
      _uid: 'a',
      component: 'page',
      relation: 'story-b',
    });
    const storyB = makeStory('story-b', {
      _uid: 'b',
      component: 'page',
      relation: 'story-a',
    });

    const inlined = inlineStoryContent(storyA, ['page.relation'], buildRelationMap([storyB, storyA]));
    const content = inlined.content;
    const inlinedB = content.relation;
    // @ts-expect-error dynamic typing
    const bContent = inlinedB?.content;

    // @ts-expect-error dynamic typing
    expect(inlinedB?.uuid).toBe('story-b');
    expect(bContent.relation?.uuid).toBe('story-a');
  });
});

describe('inlineStoriesContent', () => {
  it('should replace UUID arrays in target fields', () => {
    const tag1 = makeStory('tag-1', { _uid: 'tag-1', component: 'tag' });
    const tag2 = makeStory('tag-2', { _uid: 'tag-2', component: 'tag' });
    const page = makeStory('page-2', {
      _uid: 'page-2',
      component: 'page',
      related: ['tag-1', 'tag-2', 'missing'],
    });

    const [inlinedPage] = inlineStoriesContent([page], ['page.related'], buildRelationMap([tag1, tag2]));
    const content = inlinedPage.content;
    const related = content.related;

    // @ts-expect-error dynamic typing
    expect(related?.[0].uuid).toBe('tag-1');
    // @ts-expect-error dynamic typing
    expect(related?.[1].uuid).toBe('tag-2');
    // @ts-expect-error dynamic typing
    expect(related?.[2]).toBe('missing');
  });
});
