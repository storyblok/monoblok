import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdateStream } from './update-stream';
import { updateStory } from '../../../stories/actions';
import type { StoryContent } from '../../../stories/constants';

// Mock the updateStory action
vi.mock('../../../stories/actions', () => ({
  updateStory: vi.fn(),
}));

describe('updateStream', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
  });

  describe('publish flag behavior', () => {
    const mockContent: StoryContent = {
      _uid: 'test-uid',
      component: 'page',
      title: 'Test Content',
    };

    it('should publish stories with "published" flag only if they were already published without changes', async () => {
      const updateStream = new UpdateStream({
        space: '12345',
        publish: 'published',
        dryRun: false,
        batchSize: 10,
      });

      vi.mocked(updateStory).mockResolvedValue({
        id: 1,
        name: 'Test Story',
        content: mockContent,
      } as any);

      return new Promise<void>((resolve) => {
        updateStream.on('finish', () => {
          // Check that updateStory was called with publish=1 for published story without changes
          expect(updateStory).toHaveBeenCalledWith('12345', 1, {
            story: {
              content: mockContent,
              id: 1,
              name: 'Published Story',
            },
            force_update: '1',
            publish: 1,
          });

          // Check that updateStory was called without publish for unpublished story
          expect(updateStory).toHaveBeenCalledWith('12345', 2, {
            story: {
              content: mockContent,
              id: 2,
              name: 'Unpublished Story',
            },
            force_update: '1',
          });

          // Check that updateStory was called without publish for published story with changes
          expect(updateStory).toHaveBeenCalledWith('12345', 3, {
            story: {
              content: mockContent,
              id: 3,
              name: 'Published Story with Changes',
            },
            force_update: '1',
          });

          resolve();
        });

        // Test case 1: Published story without changes - should be published
        updateStream.write({
          storyId: 1,
          name: 'Published Story',
          content: mockContent,
          published: true,
          unpublished_changes: false,
        });

        // Test case 2: Unpublished story - should NOT be published
        updateStream.write({
          storyId: 2,
          name: 'Unpublished Story',
          content: mockContent,
          published: false,
          unpublished_changes: false,
        });

        // Test case 3: Published story with changes - should NOT be published
        updateStream.write({
          storyId: 3,
          name: 'Published Story with Changes',
          content: mockContent,
          published: true,
          unpublished_changes: true,
        });

        updateStream.end();
      });
    });

    it('should publish stories with "published-with-changes" flag only if they have unpublished changes', async () => {
      const updateStream = new UpdateStream({
        space: '12345',
        publish: 'published-with-changes',
        dryRun: false,
        batchSize: 10,
      });

      vi.mocked(updateStory).mockResolvedValue({
        id: 1,
        name: 'Test Story',
        content: mockContent,
      } as any);

      return new Promise<void>((resolve) => {
        updateStream.on('finish', () => {
          // Check that updateStory was called without publish for published story without changes
          expect(updateStory).toHaveBeenCalledWith('12345', 1, {
            story: {
              content: mockContent,
              id: 1,
              name: 'Published Story',
            },
            force_update: '1',
          });

          // Check that updateStory was called without publish for unpublished story
          expect(updateStory).toHaveBeenCalledWith('12345', 2, {
            story: {
              content: mockContent,
              id: 2,
              name: 'Unpublished Story',
            },
            force_update: '1',
          });

          // Check that updateStory was called with publish=1 for published story with changes
          expect(updateStory).toHaveBeenCalledWith('12345', 3, {
            story: {
              content: mockContent,
              id: 3,
              name: 'Published Story with Changes',
            },
            force_update: '1',
            publish: 1,
          });

          resolve();
        });

        // Test case 1: Published story without changes - should NOT be published
        updateStream.write({
          storyId: 1,
          name: 'Published Story',
          content: mockContent,
          published: true,
          unpublished_changes: false,
        });

        // Test case 2: Unpublished story - should NOT be published
        updateStream.write({
          storyId: 2,
          name: 'Unpublished Story',
          content: mockContent,
          published: false,
          unpublished_changes: false,
        });

        // Test case 3: Published story with changes - should be published
        updateStream.write({
          storyId: 3,
          name: 'Published Story with Changes',
          content: mockContent,
          published: true,
          unpublished_changes: true,
        });

        updateStream.end();
      });
    });

    it('should publish all stories with "all" flag regardless of their status', async () => {
      const updateStream = new UpdateStream({
        space: '12345',
        publish: 'all',
        dryRun: false,
        batchSize: 10,
      });

      vi.mocked(updateStory).mockResolvedValue({
        id: 1,
        name: 'Test Story',
        content: mockContent,
      } as any);

      return new Promise<void>((resolve) => {
        updateStream.on('finish', () => {
          // Check that all updateStory calls included publish=1
          expect(updateStory).toHaveBeenCalledWith('12345', 1, {
            story: {
              content: mockContent,
              id: 1,
              name: 'Published Story',
            },
            force_update: '1',
            publish: 1,
          });

          expect(updateStory).toHaveBeenCalledWith('12345', 2, {
            story: {
              content: mockContent,
              id: 2,
              name: 'Unpublished Story',
            },
            force_update: '1',
            publish: 1,
          });

          expect(updateStory).toHaveBeenCalledWith('12345', 3, {
            story: {
              content: mockContent,
              id: 3,
              name: 'Published Story with Changes',
            },
            force_update: '1',
            publish: 1,
          });

          resolve();
        });

        // All stories should be published regardless of their status
        updateStream.write({
          storyId: 1,
          name: 'Published Story',
          content: mockContent,
          published: true,
          unpublished_changes: false,
        });

        updateStream.write({
          storyId: 2,
          name: 'Unpublished Story',
          content: mockContent,
          published: false,
          unpublished_changes: false,
        });

        updateStream.write({
          storyId: 3,
          name: 'Published Story with Changes',
          content: mockContent,
          published: true,
          unpublished_changes: true,
        });

        updateStream.end();
      });
    });

    it('should not publish any stories when no publish flag is provided', async () => {
      const updateStream = new UpdateStream({
        space: '12345',
        dryRun: false,
        batchSize: 10,
      });

      vi.mocked(updateStory).mockResolvedValue({
        id: 1,
        name: 'Test Story',
        content: mockContent,
      } as any);

      return new Promise<void>((resolve) => {
        updateStream.on('finish', () => {
          // Check that no updateStory calls included publish=1
          expect(updateStory).toHaveBeenCalledWith('12345', 1, {
            story: {
              content: mockContent,
              id: 1,
              name: 'Test Story',
            },
            force_update: '1',
          });

          resolve();
        });

        updateStream.write({
          storyId: 1,
          name: 'Test Story',
          content: mockContent,
          published: true,
          unpublished_changes: false,
        });

        updateStream.end();
      });
    });
  });
});
