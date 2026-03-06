import { describe, expect, it } from 'vitest';
import { defineField } from './define-field';
import { defineProp } from './define-prop';
import { defineComponent } from './define-component';
import { defineStory } from './define-story';

describe('defineStory', () => {
  const component = defineComponent({
    created_at: '',
    id: 0,
    name: 'page',
    updated_at: '',
    schema: {
      headline: defineProp(defineField({ type: 'text' }), { pos: 1 }),
    },
  });

  it('should return a type safe CAPI story', () => {
    const story = {
      alternates: [],
      content: {
        component: 'page' as const,
        headline: 'Hello',
      },
      created_at: '',
      default_full_slug: null,
      first_published_at: null,
      full_slug: '',
      group_id: '',
      id: 0,
      is_startpage: false,
      lang: '',
      meta_data: null,
      name: '',
      parent_id: null,
      path: null,
      position: 0,
      published_at: null,
      release_id: null,
      slug: '',
      sort_by_date: null,
      tag_list: [],
      translated_slugs: null,
      updated_at: '',
      uuid: '',
    };
    const typeSafeStory = defineStory(component, story);

    expect(typeSafeStory).toEqual(story);
  });
});
