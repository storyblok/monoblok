import { describe, expect, it } from 'vitest';
import { isStoryPublishedWithoutChanges, isStoryWithUnpublishedChanges } from './utils';

describe('story utils', () => {
  describe('isStoryPublishedWithoutChanges', () => {
    it('should return true for published stories without changes', () => {
      expect(isStoryPublishedWithoutChanges({ published: true, unpublished_changes: false })).toBe(true);
    });

    it('should return false for unpublished stories', () => {
      expect(isStoryPublishedWithoutChanges({ published: false, unpublished_changes: false })).toBe(false);
    });

    it('should return false for published stories with changes', () => {
      expect(isStoryPublishedWithoutChanges({ published: true, unpublished_changes: true })).toBe(false);
    });

    it('should return false for unpublished stories with changes', () => {
      expect(isStoryPublishedWithoutChanges({ published: false, unpublished_changes: true })).toBe(false);
    });
  });

  describe('isStoryWithUnpublishedChanges', () => {
    it('should return true for published stories with changes', () => {
      expect(isStoryWithUnpublishedChanges({ published: true, unpublished_changes: true })).toBe(true);
    });

    it('should return false for published stories without changes', () => {
      expect(isStoryWithUnpublishedChanges({ published: true, unpublished_changes: false })).toBe(false);
    });

    it('should return false for unpublished stories', () => {
      expect(isStoryWithUnpublishedChanges({ published: false, unpublished_changes: false })).toBe(false);
    });

    it('should return false for unpublished stories with changes', () => {
      expect(isStoryWithUnpublishedChanges({ published: false, unpublished_changes: true })).toBe(false);
    });
  });
});
