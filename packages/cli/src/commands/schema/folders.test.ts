import { describe, expect, it } from 'vitest';

import type { ComponentFolder } from '../../types';
import { buildGroupDisplayPathByUuid, buildGroupPathByUuid, expandFolderPath, slugifyPath } from './folders';

function folder(partial: Partial<ComponentFolder> & { name: string; uuid: string }): ComponentFolder {
  return { id: 1, parent_id: null, parent_uuid: null, ...partial };
}

describe('buildGroupPathByUuid', () => {
  it('builds slugified path segments, walking the parent chain', () => {
    const layout = folder({ name: 'My Layout', uuid: 'layout-uuid' });
    const nested = folder({ name: 'Hero Sections', uuid: 'nested-uuid', parent_uuid: 'layout-uuid' });

    const paths = buildGroupPathByUuid([layout, nested]);

    expect(paths.get('layout-uuid')).toEqual(['my-layout']);
    expect(paths.get('nested-uuid')).toEqual(['my-layout', 'hero-sections']);
  });

  it('returns root groups as a single slugified segment', () => {
    const paths = buildGroupPathByUuid([folder({ name: 'Content', uuid: 'content-uuid' })]);
    expect(paths.get('content-uuid')).toEqual(['content']);
  });

  it('does not overflow on a self-referential group (parent_uuid === uuid)', () => {
    const loopy = folder({ name: 'Loopy', uuid: 'self-uuid', parent_uuid: 'self-uuid' });

    const paths = buildGroupPathByUuid([loopy]);

    // Cyclic ancestry is broken: the group is treated as a path root.
    expect(paths.get('self-uuid')).toEqual(['loopy']);
  });

  it('does not overflow on a multi-group parent cycle (A -> B -> A)', () => {
    const a = folder({ name: 'A', uuid: 'uuid-a', parent_uuid: 'uuid-b' });
    const b = folder({ name: 'B', uuid: 'uuid-b', parent_uuid: 'uuid-a' });

    expect(() => buildGroupPathByUuid([a, b])).not.toThrow();
  });
});

describe('slugifyPath', () => {
  it('should slugify each segment', () => {
    expect(slugifyPath('My Layout/Heros')).toBe('my-layout/heros');
  });

  it('should drop a trailing empty segment', () => {
    expect(slugifyPath('Layout/')).toBe('layout');
  });

  // Golden cases shared with @storyblok/schema's slugifyFolderPath
  // (packages/schema/src/utils/slugify-folder-path.test.ts). The two
  // implementations live in separate packages but MUST agree so folder-path
  // identity is the same in the schema validators and the CLI — keep both
  // tables in sync when either changes.
  it('should match the schema package folder-path canonicalization (golden cases)', () => {
    expect(slugifyPath('Layout/Heros')).toBe(slugifyPath('layout/heros'));
    expect(slugifyPath('My Layout')).toBe(slugifyPath('my-layout'));
    expect(slugifyPath('Layout//Heros')).toBe('layout/heros');
    expect(slugifyPath('Hero & Teaser')).toBe('hero-teaser');
    expect(slugifyPath('')).toBe('');
    expect(slugifyPath('/')).toBe('');
    // Segment that is non-empty raw but slugifies to empty must be dropped
    // (filter after slugify), not left as a double slash.
    expect(slugifyPath('A/&/B')).toBe('a/b');
    expect(slugifyPath('Layout/&/Heros')).toBe('layout/heros');
    expect(slugifyPath('Layout/---/Heros')).toBe('layout/heros');
  });
});

describe('expandFolderPath', () => {
  it('should expand a nested path parent-first', () => {
    expect(expandFolderPath('Layout/Heros')).toEqual([
      { name: 'Layout', path: 'layout', parentPath: null },
      { name: 'Heros', path: 'layout/heros', parentPath: 'layout' },
    ]);
  });

  it('should handle a root path', () => {
    expect(expandFolderPath('Layout')).toEqual([
      { name: 'Layout', path: 'layout', parentPath: null },
    ]);
  });

  it('should drop a middle segment that slugifies to empty (matching slugifyPath identity)', () => {
    expect(expandFolderPath('Layout/&/Heros')).toEqual([
      { name: 'Layout', path: 'layout', parentPath: null },
      { name: 'Heros', path: 'layout/heros', parentPath: 'layout' },
    ]);
  });
});

describe('buildGroupDisplayPathByUuid', () => {
  it('joins parent display names with slashes, preserving original casing', () => {
    const folders = [
      { uuid: 'a', name: 'My Layout', parent_uuid: null },
      { uuid: 'b', name: 'Heros', parent_uuid: 'a' },
    ];

    const result = buildGroupDisplayPathByUuid(folders as never);

    expect(result.get('a')).toBe('My Layout');
    expect(result.get('b')).toBe('My Layout/Heros');
  });

  it('treats a cyclic parent chain as a root instead of recursing forever', () => {
    const folders = [
      { uuid: 'a', name: 'A', parent_uuid: 'b' },
      { uuid: 'b', name: 'B', parent_uuid: 'a' },
    ];

    const result = buildGroupDisplayPathByUuid(folders as never);

    // When pathFor('a') recurses into pathFor('b'), which recurses back into
    // pathFor('a'), the cycle is detected and cut (visited.has('a') is true),
    // returning []. This bubbles up to set b=['B'], then a=['B', 'A'].
    expect(result.get('a')).toBe('B/A');
    expect(result.get('b')).toBe('B');
  });

  it('ignores a parent uuid that is not in the folder list', () => {
    const folders = [{ uuid: 'a', name: 'Orphan', parent_uuid: 'missing' }];

    expect(buildGroupDisplayPathByUuid(folders as never).get('a')).toBe('Orphan');
  });
});
