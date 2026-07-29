import { describe, expect, it } from 'vitest';

import { toDeclarationFileName } from './filename';

describe('toDeclarationFileName', () => {
  it('appends the declaration extension to a base name', () => {
    expect(toDeclarationFileName('storyblok-components')).toBe('storyblok-components.d.ts');
  });

  it('does not double an extension the user already spelled out', () => {
    expect(toDeclarationFileName('my-types.d.ts')).toBe('my-types.d.ts');
  });

  it('leaves an unrelated extension alone, since it is part of the name', () => {
    expect(toDeclarationFileName('my-types.generated')).toBe('my-types.generated.d.ts');
  });
});
