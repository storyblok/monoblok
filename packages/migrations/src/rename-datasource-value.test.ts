import { describe, expect, it } from 'vitest';
import { renameDataSourceValue } from './rename-datasource-value';

const makeStory = (content: Record<string, unknown>) => ({
  id: 1,
  uuid: 'story-uuid',
  name: 'Test Story',
  slug: 'test-story',
  full_slug: 'test-story',
  content: { component: 'page', ...content },
  created_at: '2024-01-01T00:00:00.000Z',
  published_at: undefined,
  updated_at: '2024-01-01T00:00:00.000Z',
});

describe('renameDataSourceValue', () => {
  it('should rename single option field value', () => {
    const story = makeStory({ category: 'old-value' });
    const componentsToUpdate = [{ field: 'category', name: 'page' }];
    const { story: result } = renameDataSourceValue(
      story as any,
      componentsToUpdate,
      'old-value',
      'new-value',
    );
    expect((result.content as any).category).toBe('new-value');
  });

  it('should rename matching values in multi-options array', () => {
    const story = makeStory({ tags: ['old-value', 'keep-this', 'old-value'] });
    const componentsToUpdate = [{ field: 'tags', name: 'page' }];
    const { story: result } = renameDataSourceValue(
      story as any,
      componentsToUpdate,
      'old-value',
      'new-value',
    );
    expect((result.content as any).tags).toEqual([
      'new-value',
      'keep-this',
      'new-value',
    ]);
  });

  it('should traverse nested bloks and rename values in nested components', () => {
    const story = makeStory({
      body: [{ component: 'card', _uid: 'uid1', category: 'old-value' }],
    });
    const componentsToUpdate = [{ field: 'category', name: 'card' }];
    const { story: result } = renameDataSourceValue(
      story as any,
      componentsToUpdate,
      'old-value',
      'new-value',
    );
    expect((result.content as any).body[0].category).toBe('new-value');
  });

  it('should leave non-matching values untouched', () => {
    const story = makeStory({ category: 'other-value' });
    const componentsToUpdate = [{ field: 'category', name: 'page' }];
    const { story: result } = renameDataSourceValue(
      story as any,
      componentsToUpdate,
      'old-value',
      'new-value',
    );
    expect((result.content as any).category).toBe('other-value');
  });

  it('should leave components not in componentsToUpdate untouched', () => {
    const story = makeStory({ category: 'old-value' });
    const componentsToUpdate = [{ field: 'category', name: 'other-component' }];
    const { story: result } = renameDataSourceValue(
      story as any,
      componentsToUpdate,
      'old-value',
      'new-value',
    );
    expect((result.content as any).category).toBe('old-value');
  });

  it('should return changes log with component, field, and path', () => {
    const story = makeStory({ category: 'old-value' });
    const componentsToUpdate = [{ field: 'category', name: 'page' }];
    const { changes } = renameDataSourceValue(
      story as any,
      componentsToUpdate,
      'old-value',
      'new-value',
    );
    expect(changes).toHaveLength(1);
    expect(changes[0].component).toBe('page');
    expect(changes[0].field).toBe('category');
  });
});
