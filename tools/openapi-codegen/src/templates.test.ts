import { describe, expect, it } from 'vitest';
import { ALIAS_BY_EMIT_NAME } from './aliases.ts';
import { templateFor, TEMPLATES, type WrapperFile } from './templates.ts';

describe('templateFor', () => {
  it('should resolve a template main type to its file', () => {
    expect(templateFor('Block')).toBe('block');
    expect(templateFor('Story')).toBe('story');
    expect(templateFor('MapiStory')).toBe('mapi-story');
  });

  it('should resolve a pass-through name to the providing file', () => {
    expect(templateFor('FieldValue')).toBe('field');
    expect(templateFor('StoryCreate')).toBe('mapi-story');
  });

  it('should return undefined for an unknown name', () => {
    expect(templateFor('NotARealType')).toBeUndefined();
  });
});

describe('template / alias coupling', () => {
  it('should back every template source leaf with a defined alias', () => {
    // `generate()` looks each leaf up in ALIAS_BY_EMIT_NAME and throws at
    // runtime if missing. This catches that drift at build time instead.
    const missing: string[] = [];
    for (const meta of Object.values(TEMPLATES)) {
      for (const leaf of meta.sourceLeaves) {
        if (!ALIAS_BY_EMIT_NAME.has(leaf)) {
          missing.push(leaf);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it('should only reference template deps that exist', () => {
    const files = new Set(Object.keys(TEMPLATES) as WrapperFile[]);
    const unknown: string[] = [];
    for (const meta of Object.values(TEMPLATES)) {
      for (const dep of meta.templateDeps) {
        if (!files.has(dep)) {
          unknown.push(dep);
        }
      }
    }

    expect(unknown).toEqual([]);
  });

  it('should not provide the same name from more than one template', () => {
    // Duplicate `provides` entries would make `templateFor` resolution
    // order-dependent (last-wins in the index).
    const seen = new Map<string, WrapperFile>();
    const duplicates: string[] = [];
    for (const [file, meta] of Object.entries(TEMPLATES) as [WrapperFile, typeof TEMPLATES[WrapperFile]][]) {
      for (const name of meta.provides) {
        if (seen.has(name)) {
          duplicates.push(name);
        }
        else {
          seen.set(name, file);
        }
      }
    }

    expect(duplicates).toEqual([]);
  });
});
