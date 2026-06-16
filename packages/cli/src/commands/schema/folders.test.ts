import { describe, expect, it } from 'vitest';

import type { ComponentFolder } from '../../types';
import { buildGroupPathByUuid } from './folders';

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
});
