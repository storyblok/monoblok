import { describe, expect, it } from 'vitest';
import { collectReferencedAssetIds } from './referenced';

describe('collectReferencedAssetIds', () => {
  it('extracts numeric asset ids from story asset fields, including nested ones', () => {
    const stories = [{
      content: {
        hero: { fieldtype: 'asset', id: 42, filename: 'x' },
        body: [{ image: { fieldtype: 'asset', id: 43 } }],
      },
    }];

    expect([...collectReferencedAssetIds(stories)].sort((a, b) => a - b)).toEqual([42, 43]);
  });

  it('ignores asset fields without a numeric id', () => {
    const stories = [{ content: { hero: { fieldtype: 'asset', id: null, filename: '' } } }];

    expect(collectReferencedAssetIds(stories).size).toBe(0);
  });

  it('returns an empty set when there are no stories', () => {
    expect(collectReferencedAssetIds([]).size).toBe(0);
  });
});
