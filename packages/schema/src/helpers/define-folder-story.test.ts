import { describe, expect, it } from 'vitest';

import { defineFolderStory } from './define-folder-story';

describe('defineFolderStory', () => {
  it('should return a folder story with is_folder set to true', () => {
    const folder = defineFolderStory({
      name: 'Blog',
    });

    expect(folder).toMatchObject({
      name: 'Blog',
      is_folder: true,
      id: 1,
      uuid: '',
      slug: '',
      content: {},
    });
  });

  it('should allow overriding default fields', () => {
    const folder = defineFolderStory({
      name: 'Blog',
      id: 42,
      uuid: 'abc-123',
      slug: 'blog',
      full_slug: 'blog',
      parent_id: 10,
    });

    expect(folder).toMatchObject({
      name: 'Blog',
      id: 42,
      uuid: 'abc-123',
      slug: 'blog',
      full_slug: 'blog',
      parent_id: 10,
      is_folder: true,
    });
  });

  it('should always set is_folder to true', () => {
    const folder = defineFolderStory({ name: 'Test' });

    expect(folder.is_folder).toBe(true);
  });
});
