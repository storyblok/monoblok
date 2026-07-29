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

  it('should normalize block refs in deny to their names', () => {
    const hero = { name: 'hero', fields: [] } as const;
    const field = defineField('body', { type: 'bloks', deny: [hero, 'banner'] });
    expect(field.deny).toEqual(['hero', 'banner']);
  });

  it('should throw when deny holds a folder reference', () => {
    // A folder ref carries a `name`, so it structurally passes for a block ref;
    // the runtime guard is what keeps it from silently denying by folder name.
    const heros = defineFolder({ name: 'Heros' });
    expect(() => defineField('body', { type: 'bloks', deny: [heros] }))
      .toThrow('defineField: "deny" on field "body" does not accept folder references; the editor denies by block name only');
  });
});
