import { describe, expect, it } from 'vitest';
import { defineField } from './define-field';
import { defineFolder } from './define-folder';

describe('defineField', () => {
  it('should normalize folder refs in allow to tagged path entries', () => {
    const heros = defineFolder({ name: 'Heros', parent: defineFolder({ name: 'Layout' }) });
    const field = defineField('body', { type: 'bloks', allow: [heros] });
    expect(field.allow).toEqual([{ folder: 'Layout/Heros' }]);
  });

  it('should throw when allow mixes blocks and folders', () => {
    const heros = defineFolder({ name: 'Heros' });
    expect(() => defineField('body', { type: 'bloks', allow: [heros, 'teaser'] }))
      .toThrow('defineField: "allow" on field "body" mixes block and folder references; the editor restricts by either blocks or folders, not both');
  });

  it('should keep block-only allow unchanged', () => {
    const field = defineField('body', { type: 'bloks', allow: ['teaser'] });
    expect(field.allow).toEqual(['teaser']);
  });
});
