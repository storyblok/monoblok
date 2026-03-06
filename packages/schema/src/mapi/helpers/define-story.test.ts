import { describe, expect, it } from 'vitest';
import { defineField } from '../../helpers/define-field';
import { defineProp } from '../../helpers/define-prop';
import { defineComponent } from '../../helpers/define-component';
import { defineStory, defineStoryCreate, defineStoryUpdate } from './define-story';

describe('mapi/defineStory', () => {
  const component = defineComponent({
    created_at: '',
    id: 0,
    name: 'page',
    updated_at: '',
    schema: {
      headline: defineProp(defineField({ type: 'text' }), { pos: 1 }),
    },
  });

  it('should return a type safe MAPI story', () => {
    const story = {
      alternates: [],
      content: {
        component: 'page' as const,
        headline: 'Hello',
      },
      created_at: '',
      first_published_at: null,
      full_slug: '',
      group_id: '',
      id: 0,
      is_startpage: false,
      meta_data: null,
      name: '',
      parent_id: null,
      path: null,
      position: 0,
      published_at: null,
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

describe('mapi/defineStoryCreate', () => {
  const component = defineComponent({
    created_at: '',
    id: 0,
    name: 'page',
    updated_at: '',
    schema: {
      headline: defineProp(defineField({ type: 'text' }), { pos: 1 }),
    },
  });

  it('should return a type safe story create payload', () => {
    const payload = {
      name: 'My Page',
      content: {
        component: 'page' as const,
        headline: 'Hello',
      },
    };
    const result = defineStoryCreate(component, payload);

    expect(result).toEqual(payload);
  });

  it('should accept minimal create payload (name only)', () => {
    const payload = { name: 'My Page' };
    const result = defineStoryCreate(component, payload);

    expect(result).toEqual(payload);
  });
});

describe('mapi/defineStoryUpdate', () => {
  const component = defineComponent({
    created_at: '',
    id: 0,
    name: 'page',
    updated_at: '',
    schema: {
      headline: defineProp(defineField({ type: 'text' }), { pos: 1 }),
    },
  });

  it('should return a type safe story update payload', () => {
    const payload = {
      content: {
        component: 'page' as const,
        headline: 'Updated!',
      },
    };
    const result = defineStoryUpdate(component, payload);

    expect(result).toEqual(payload);
  });

  it('should accept empty update payload', () => {
    const payload = {};
    const result = defineStoryUpdate(component, payload);

    expect(result).toEqual(payload);
  });
});
