import { describe, expect, it } from 'vitest';

import type { DiffResult, RemoteSchemaData, SchemaData } from '../../types';

import { analyzeBreakingChanges, classifyFieldChanges, detectRenames } from './analyze';

const makeSchema = (fields: Record<string, { type: string; required?: boolean }>) =>
  fields as Record<string, { type: string; required?: boolean }>;

describe('classifyFieldChanges', () => {
  it('detects removed fields', () => {
    const remote = makeSchema({ title: { type: 'text' }, subtitle: { type: 'text' } });
    const local = makeSchema({ title: { type: 'text' } });

    const result = classifyFieldChanges(remote, local);

    expect(result.removed).toEqual([{ field: 'subtitle', type: 'text' }]);
    expect(result.added).toEqual([]);
    expect(result.typeChanged).toEqual([]);
    expect(result.requiredAdded).toEqual([]);
  });

  it('detects added fields', () => {
    const remote = makeSchema({ title: { type: 'text' } });
    const local = makeSchema({ title: { type: 'text' }, body: { type: 'richtext' } });

    const result = classifyFieldChanges(remote, local);

    expect(result.added).toEqual([{ field: 'body', type: 'richtext', required: false }]);
    expect(result.removed).toEqual([]);
    expect(result.typeChanged).toEqual([]);
    expect(result.requiredAdded).toEqual([]);
  });

  it('detects type changes', () => {
    const remote = makeSchema({ count: { type: 'text' } });
    const local = makeSchema({ count: { type: 'number' } });

    const result = classifyFieldChanges(remote, local);

    expect(result.typeChanged).toEqual([{ field: 'count', oldType: 'text', newType: 'number' }]);
    expect(result.removed).toEqual([]);
    expect(result.added).toEqual([]);
    expect(result.requiredAdded).toEqual([]);
  });

  it('detects new required fields (field not in remote, in local with required: true)', () => {
    const remote = makeSchema({ title: { type: 'text' } });
    const local = makeSchema({ title: { type: 'text' }, slug: { type: 'text', required: true } });

    const result = classifyFieldChanges(remote, local);

    expect(result.requiredAdded).toEqual([{ field: 'slug', type: 'text' }]);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.typeChanged).toEqual([]);
  });

  it('ignores _uid and component sentinel fields', () => {
    const remote = makeSchema({ _uid: { type: 'text' }, component: { type: 'text' }, title: { type: 'text' } });
    const local = makeSchema({ _uid: { type: 'text' }, component: { type: 'text' }, title: { type: 'text' } });

    const result = classifyFieldChanges(remote, local);

    expect(result.removed).toEqual([]);
    expect(result.added).toEqual([]);
    expect(result.typeChanged).toEqual([]);
    expect(result.requiredAdded).toEqual([]);
  });

  it('returns empty results for identical schemas', () => {
    const schema = makeSchema({ title: { type: 'text' }, image: { type: 'asset' } });

    const result = classifyFieldChanges(schema, schema);

    expect(result.removed).toEqual([]);
    expect(result.added).toEqual([]);
    expect(result.typeChanged).toEqual([]);
    expect(result.requiredAdded).toEqual([]);
    expect(result.requiredChanged).toEqual([]);
  });

  it('detects when an existing field becomes required', () => {
    const remote = makeSchema({ title: { type: 'text' } });
    const local = makeSchema({ title: { type: 'text', required: true } });

    const result = classifyFieldChanges(remote, local);

    expect(result.requiredChanged).toEqual([{ field: 'title', type: 'text' }]);
    expect(result.removed).toEqual([]);
    expect(result.added).toEqual([]);
    expect(result.typeChanged).toEqual([]);
    expect(result.requiredAdded).toEqual([]);
  });

  it('does not flag requiredChanged when field was already required', () => {
    const remote = makeSchema({ title: { type: 'text', required: true } });
    const local = makeSchema({ title: { type: 'text', required: true } });

    const result = classifyFieldChanges(remote, local);

    expect(result.requiredChanged).toEqual([]);
  });
});

describe('detectRenames', () => {
  it('matches a single rename when one removed and one added field share the same type', () => {
    const removed = [{ field: 'hero_image', type: 'asset' }];
    const added = [{ field: 'hero_banner', type: 'asset', required: false }];

    const result = detectRenames(removed, added);

    expect(result.renames).toEqual([{ oldField: 'hero_image', newField: 'hero_banner', fieldType: 'asset' }]);
    expect(result.unmatchedRemoved).toEqual([]);
    expect(result.unmatchedAdded).toEqual([]);
  });

  it('does not match when types differ', () => {
    const removed = [{ field: 'title', type: 'text' }];
    const added = [{ field: 'title_new', type: 'number', required: false }];

    const result = detectRenames(removed, added);

    expect(result.renames).toEqual([]);
    expect(result.unmatchedRemoved).toEqual([{ field: 'title', type: 'text' }]);
    expect(result.unmatchedAdded).toEqual([{ field: 'title_new', type: 'number', required: false }]);
  });

  it('picks the most name-similar candidate when multiple candidates share the same type', () => {
    // hero_image → hero_banner (asset, high similarity)
    // author_bio → bio (text, lower similarity)
    const removed = [
      { field: 'hero_image', type: 'asset' },
      { field: 'author_bio', type: 'text' },
    ];
    const added = [
      { field: 'hero_banner', type: 'asset', required: false },
      { field: 'bio', type: 'text', required: false },
    ];

    const result = detectRenames(removed, added);

    expect(result.renames).toEqual([
      { oldField: 'hero_image', newField: 'hero_banner', fieldType: 'asset' },
      { oldField: 'author_bio', newField: 'bio', fieldType: 'text' },
    ]);
    expect(result.unmatchedRemoved).toEqual([]);
    expect(result.unmatchedAdded).toEqual([]);
  });

  it('leaves unmatched fields when no type match is found', () => {
    const removed = [{ field: 'old_field', type: 'richtext' }];
    const added = [{ field: 'new_field', type: 'markdown', required: false }];

    const result = detectRenames(removed, added);

    expect(result.renames).toEqual([]);
    expect(result.unmatchedRemoved).toEqual([{ field: 'old_field', type: 'richtext' }]);
    expect(result.unmatchedAdded).toEqual([{ field: 'new_field', type: 'markdown', required: false }]);
  });

  it('handles empty inputs', () => {
    const result = detectRenames([], []);

    expect(result.renames).toEqual([]);
    expect(result.unmatchedRemoved).toEqual([]);
    expect(result.unmatchedAdded).toEqual([]);
  });

  it('should not match when name similarity is too low and there are multiple candidates', () => {
    const removed = [
      { field: 'header_image', type: 'asset' },
      { field: 'spacer', type: 'asset' },
    ];
    const added = [
      { field: 'footer_logo', type: 'asset', required: false },
      { field: 'divider', type: 'asset', required: false },
    ];

    const result = detectRenames(removed, added);

    expect(result.renames).toEqual([]);
    expect(result.unmatchedRemoved).toEqual(removed);
    expect(result.unmatchedAdded).toEqual(added);
  });

  it('matches a single 1-for-1 swap as a rename even when names are dissimilar', () => {
    // Only one field removed and one added of the same type — treat as a rename
    // regardless of name similarity. A 1-for-1 swap is overwhelmingly a rename
    // in practice.
    const removed = [{ field: 'header_image', type: 'asset' }];
    const added = [{ field: 'footer_logo', type: 'asset', required: false }];

    const result = detectRenames(removed, added);

    expect(result.renames).toEqual([
      { oldField: 'header_image', newField: 'footer_logo', fieldType: 'asset' },
    ]);
    expect(result.unmatchedRemoved).toEqual([]);
    expect(result.unmatchedAdded).toEqual([]);
  });

  // Note: detectRenames is agnostic to `required` — it matches on type + name
  // similarity. The production path (analyzeBreakingChanges) deliberately excludes
  // required fields from the rename candidate pool. This tests the helper only.
  it('matches a rename when the added field is required', () => {
    const removed = [{ field: 'headline', type: 'text' }];
    const added = [{ field: 'heading', type: 'text', required: true }];

    const result = detectRenames(removed, added);

    expect(result.renames).toEqual([
      { oldField: 'headline', newField: 'heading', fieldType: 'text' },
    ]);
    expect(result.unmatchedRemoved).toEqual([]);
    expect(result.unmatchedAdded).toEqual([]);
  });
});

describe('analyzeBreakingChanges', () => {
  it('should return breaking changes for updated components', () => {
    const local: SchemaData = {
      components: [
        { name: 'hero', schema: { author: { type: 'text', pos: 0 }, rating: { type: 'number', pos: 1 } } },
      ] as any,
      componentFolders: [],
      datasources: [],
    };
    const remote: RemoteSchemaData = {
      components: new Map([
        ['hero', { name: 'hero', schema: { author_name: { type: 'text', pos: 0 }, rating: { type: 'text', pos: 1 } } } as any],
      ]),
      componentFolders: new Map(),
      datasources: new Map(),
    };
    const diffResult: DiffResult = {
      diffs: [{ type: 'component', name: 'hero', action: 'update', diff: 'some diff', local: null, remote: null }],
      creates: 0,
      updates: 1,
      unchanged: 0,
      stale: 0,
    };

    const result = analyzeBreakingChanges(diffResult, local, remote);

    expect(result).toHaveLength(1);
    expect(result[0].componentName).toBe('hero');
    expect(result[0].changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'rename', field: 'author', oldField: 'author_name' }),
      expect.objectContaining({ kind: 'type_changed', field: 'rating', oldType: 'text', newType: 'number' }),
    ]));
  });

  it('should skip non-update diffs', () => {
    const local: SchemaData = {
      components: [{ name: 'hero', schema: { title: { type: 'text', pos: 0 } } }] as any,
      componentFolders: [],
      datasources: [],
    };
    const remote: RemoteSchemaData = {
      components: new Map(),
      componentFolders: new Map(),
      datasources: new Map(),
    };
    const diffResult: DiffResult = {
      diffs: [{ type: 'component', name: 'hero', action: 'create', diff: null, local: null, remote: null }],
      creates: 1,
      updates: 0,
      unchanged: 0,
      stale: 0,
    };

    const result = analyzeBreakingChanges(diffResult, local, remote);
    expect(result).toEqual([]);
  });

  it('should skip components with no breaking changes', () => {
    const local: SchemaData = {
      components: [{ name: 'hero', schema: { title: { type: 'text', pos: 0 }, subtitle: { type: 'text', pos: 1 } } }] as any,
      componentFolders: [],
      datasources: [],
    };
    const remote: RemoteSchemaData = {
      components: new Map([
        ['hero', { name: 'hero', schema: { title: { type: 'text', pos: 0 } } } as any],
      ]),
      componentFolders: new Map(),
      datasources: new Map(),
    };
    const diffResult: DiffResult = {
      diffs: [{ type: 'component', name: 'hero', action: 'update', diff: 'some diff', local: null, remote: null }],
      creates: 0,
      updates: 1,
      unchanged: 0,
      stale: 0,
    };

    const result = analyzeBreakingChanges(diffResult, local, remote);
    expect(result).toEqual([]);
  });

  it('should not auto-detect rename when the new field is required', () => {
    const local: SchemaData = {
      components: [
        { name: 'hero', schema: { subtitle: { type: 'text', pos: 0, required: true } } },
      ] as any,
      componentFolders: [],
      datasources: [],
    };
    const remote: RemoteSchemaData = {
      components: new Map([
        ['hero', { name: 'hero', schema: { title: { type: 'text', pos: 0 } } } as any],
      ]),
      componentFolders: new Map(),
      datasources: new Map(),
    };
    const diffResult: DiffResult = {
      diffs: [{ type: 'component', name: 'hero', action: 'update', diff: 'some diff', local: null, remote: null }],
      creates: 0,
      updates: 1,
      unchanged: 0,
      stale: 0,
    };

    const result = analyzeBreakingChanges(diffResult, local, remote);

    expect(result).toHaveLength(1);
    expect(result[0].componentName).toBe('hero');
    // Required additions must not be treated as renames — they signal new-field intent
    expect(result[0].changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'removed', field: 'title' }),
        expect.objectContaining({ kind: 'required_added', field: 'subtitle' }),
      ]),
    );
    expect(result[0].changes.filter(c => c.kind === 'rename')).toEqual([]);
  });

  it('should detect when an existing field becomes required', () => {
    const local: SchemaData = {
      components: [
        { name: 'hero', schema: { title: { type: 'text', pos: 0, required: true } } },
      ] as any,
      componentFolders: [],
      datasources: [],
    };
    const remote: RemoteSchemaData = {
      components: new Map([
        ['hero', { name: 'hero', schema: { title: { type: 'text', pos: 0 } } } as any],
      ]),
      componentFolders: new Map(),
      datasources: new Map(),
    };
    const diffResult: DiffResult = {
      diffs: [{ type: 'component', name: 'hero', action: 'update', diff: 'some diff', local: null, remote: null }],
      creates: 0,
      updates: 1,
      unchanged: 0,
      stale: 0,
    };

    const result = analyzeBreakingChanges(diffResult, local, remote);

    expect(result).toHaveLength(1);
    expect(result[0].componentName).toBe('hero');
    expect(result[0].changes).toEqual([
      { kind: 'required_changed', field: 'title', fieldType: 'text' },
    ]);
  });
});
