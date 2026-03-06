import { describe, expectTypeOf, it } from 'vitest';
import { defineComponent } from './define-component';
import { defineField } from './define-field';
import { defineProp } from './define-prop';
import { defineStory } from './define-story';

describe('defineStory type inference', () => {
  it('should constrain content to component schema types', () => {
    const component = defineComponent({
      name: 'page',
      schema: {
        headline: defineProp(defineField({ type: 'text' }), { pos: 1 }),
        count: defineProp(defineField({ type: 'number' }), { pos: 2 }),
      },
      id: 0,
      created_at: '',
      updated_at: '',
    });

    const story = defineStory(component, {
      content: {
        headline: 'Hello',
        count: 42,
        component: 'page',
      },
      name: '',
      id: 0,
      created_at: '',
      updated_at: '',
      parent_id: null,
      group_id: '',
      alternates: [],
      sort_by_date: null,
      tag_list: [],
      published_at: null,
      uuid: '',
      slug: '',
      path: null,
      full_slug: '',
      is_startpage: false,
      meta_data: null,
      first_published_at: null,
      translated_slugs: null,
      position: 0,
      default_full_slug: null,
      release_id: null,
      lang: '',
    });

    expectTypeOf(story.content.component).toEqualTypeOf<'page'>();
    expectTypeOf(story.content.headline).toEqualTypeOf<string>();
    expectTypeOf(story.content.count).toEqualTypeOf<number>();
  });

  it('should reject wrong value types in content', () => {
    const component = defineComponent({
      name: 'page',
      schema: {
        headline: defineProp(defineField({ type: 'text' }), { pos: 1 }),
      },
      id: 0,
      created_at: '',
      updated_at: '',
    });

    defineStory(component, {
      // @ts-expect-error: number is not assignable to string
      content: { headline: 42 },
    });
  });
});
