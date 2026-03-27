import { describe, expect, it } from 'vitest';
import { defineField } from '../../helpers/define-field';
import { defineProp } from '../../helpers/define-prop';
import { defineComponent } from '../../helpers/define-component';
import { defineStory, defineStoryCreate, defineStoryUpdate } from './define-story';

describe('mapi/defineStory', () => {
  const component = defineComponent({
    name: 'page',
    schema: {
      headline: defineProp(defineField({ type: 'text' }), { pos: 1 }),
    },
  });

  it('should return a type safe MAPI story', () => {
    const input = {
      name: 'My Page',
      content: {
        headline: 'Hello',
      },
    };
    const typeSafeStory = defineStory(component, input);

    expect(typeSafeStory).toMatchObject({
      name: 'My Page',
      content: { headline: 'Hello', component: 'page' },
      id: 1,
      uuid: '',
      created_at: '',
      updated_at: '',
    });
  });
});

describe('mapi/defineStoryCreate', () => {
  const component = defineComponent({
    name: 'page',
    schema: {
      headline: defineProp(defineField({ type: 'text' }), { pos: 1 }),
    },
  });

  it('should auto-inject component into content', () => {
    const result = defineStoryCreate(component, {
      name: 'My Page',
      content: { headline: 'Hello' },
    });

    expect(result).toEqual({
      name: 'My Page',
      content: { component: 'page', headline: 'Hello' },
    });
  });

  it('should accept minimal create payload (name only)', () => {
    const payload = { name: 'My Page', content: { headline: 'Test' } };
    const result = defineStoryCreate(component, payload);

    expect(result).toEqual({
      ...payload,
      content: { ...payload.content, component: 'page' },
    });
  });
});

describe('mapi/defineStoryUpdate', () => {
  const component = defineComponent({
    name: 'page',
    schema: {
      headline: defineProp(defineField({ type: 'text' }), { pos: 1 }),
    },
  });

  it('should auto-inject component into content', () => {
    const result = defineStoryUpdate(component, {
      content: { headline: 'Updated!' },
    });

    expect(result).toEqual({
      content: { component: 'page', headline: 'Updated!' },
    });
  });

  it('should accept empty update payload', () => {
    const payload = {};
    const result = defineStoryUpdate(component, payload);

    expect(result).toEqual(payload);
  });
});
