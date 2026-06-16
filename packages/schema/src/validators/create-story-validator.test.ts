import { describe, expect, it } from 'vitest';
import { defineBlock } from '../helpers/define-block';
import { defineField } from '../helpers/define-field';
import { createStoryValidator } from './create-story-validator';

const page = defineBlock({
  name: 'page',
  is_root: true,
  fields: [defineField('headline', { type: 'text', required: true })],
});
const schema = { blocks: { page } };

/** Standard Schema validators are synchronous here; unwrap the (never-async) result. */
function validate(validator: ReturnType<typeof createStoryValidator>, value: unknown) {
  const result = validator['~standard'].validate(value);
  if (result instanceof Promise) {
    throw new TypeError('expected synchronous validation');
  }
  return result;
}

describe('createStoryValidator', () => {
  it('returns a valid StandardSchemaV1 object', () => {
    const validator = createStoryValidator(page, schema);
    expect(validator['~standard'].version).toBe(1);
    expect(validator['~standard'].vendor).toBe('storyblok-schema');
    expect(typeof validator['~standard'].validate).toBe('function');
  });

  it('yields { value } for a valid story', () => {
    const validator = createStoryValidator(page, schema);
    const story = { content: { component: 'page', headline: 'Hi' } };
    const result = validate(validator, story);
    expect(result.issues).toBeUndefined();
    expect('value' in result && result.value).toBe(story);
  });

  it('yields { issues } when a required field is missing', () => {
    const validator = createStoryValidator(page, schema);
    const result = validate(validator, { content: { component: 'page' } });
    expect(result.issues?.length).toBeGreaterThan(0);
  });

  it('flags a root component that does not match the root block', () => {
    const validator = createStoryValidator(page, schema);
    const result = validate(validator, { content: { component: 'teaser' } });
    expect(result.issues?.some(i => i.message.includes('Expected root component "page"'))).toBe(true);
  });
});
