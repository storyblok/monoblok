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
    });

    const story = defineStory(component, {
      name: 'Home',
      content: {
        headline: 'Hello',
        count: 42,
      },
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
    });

    defineStory(component, {
      name: 'Home',
      // @ts-expect-error: number is not assignable to string
      content: { headline: 42 },
    });
  });
});
