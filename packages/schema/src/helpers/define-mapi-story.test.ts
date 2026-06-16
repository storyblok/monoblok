import { describe, expect, it } from 'vitest';
import { defineField } from './define-field';
import { defineBlock } from './define-block';
import { defineMapiStory, defineStoryCreate, defineStoryUpdate } from './define-story';

describe('defineMapiStory', () => {
  const block = defineBlock({
    name: 'page',
    is_root: true,
    fields: [
      defineField('headline', { type: 'text' }),
    ],
  });

  it('should return a type safe MAPI story', () => {
    const typeSafeStory = defineMapiStory(block, {
      name: 'My Page',
      content: { headline: 'Hello' },
    });

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

describe('defineStoryCreate', () => {
  const block = defineBlock({
    name: 'page',
    is_root: true,
    fields: [
      defineField('headline', { type: 'text' }),
    ],
  });

  it('should auto-inject component into content', () => {
    const result = defineStoryCreate(block, {
      name: 'My Page',
      content: { headline: 'Hello' },
    });

    expect(result).toEqual({
      name: 'My Page',
      content: { component: 'page', headline: 'Hello' },
    });
  });
});

describe('defineStoryUpdate', () => {
  const block = defineBlock({
    name: 'page',
    is_root: true,
    fields: [
      defineField('headline', { type: 'text' }),
    ],
  });

  it('should auto-inject component into content', () => {
    const result = defineStoryUpdate(block, {
      content: { headline: 'Updated!' },
    });

    expect(result).toEqual({
      content: { component: 'page', headline: 'Updated!' },
    });
  });
});
