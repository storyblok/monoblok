import { describe, expect, it } from 'vitest';
import { defineField } from './define-field';
import { defineProp } from './define-prop';
import { defineComponent } from './define-component';
import { defineStory } from './define-story';

describe('defineStory', () => {
  const component = defineComponent({
    name: 'page',
    schema: {
      headline: defineProp(defineField({ type: 'text' }), { pos: 1 }),
    },
  });

  it('should return a type safe CAPI story', () => {
    const input = {
      name: 'Home',
      content: {
        headline: 'Hello',
      },
    };
    const typeSafeStory = defineStory(component, input);

    expect(typeSafeStory).toMatchObject({
      name: 'Home',
      content: { headline: 'Hello', component: 'page' },
      id: 1,
      uuid: '',
      created_at: '',
      updated_at: '',
    });
  });
});
