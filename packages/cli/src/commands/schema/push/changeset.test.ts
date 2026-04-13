import { describe, expect, it } from 'vitest';
import { vol } from 'memfs';

import type { ChangesetData } from '../types';

import { saveChangeset } from './changeset';

describe('saveChangeset', () => {
  it('should write changeset JSON to the correct path', async () => {
    vol.fromJSON({ '.storyblok/schema/changesets/.gitkeep': '' });

    const changeset: ChangesetData = {
      timestamp: '2026-04-09T14:30:00.000Z',
      spaceId: 12345,
      remote: { components: [], componentFolders: [], datasources: [] },
      changes: [],
    };

    const path = await saveChangeset('.storyblok', changeset);

    expect(path).toContain('.storyblok/schema/changesets/');
    expect(path).toContain('.json');
    const content = vol.readFileSync(path, 'utf-8') as string;
    expect(JSON.parse(content)).toEqual(changeset);
  });
});
