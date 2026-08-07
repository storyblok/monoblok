import { describe, expect, it } from 'vitest';
import { storyblokColorField } from './storyblok-color-field';

describe('storyblokColorField', () => {
  it('registers the storyblok-colorpicker field type', () => {
    expect(storyblokColorField.fieldType).toBe('storyblok-colorpicker');
  });

  it('accepts a value with a string color', async () => {
    const result = await storyblokColorField.value['~standard'].validate({ color: '#ffffff' });
    expect(result).toEqual({ value: { color: '#ffffff' } });
  });

  it('reports an issue for a malformed value', async () => {
    const result = await storyblokColorField.value['~standard'].validate({ color: 123 });
    expect('issues' in result).toBe(true);
  });
});
