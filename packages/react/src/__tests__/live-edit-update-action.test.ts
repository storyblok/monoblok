import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { liveEditUpdateAction } from '../rsc/live-edit-update-action';

describe('liveEditUpdateAction', () => {
  const mockRevalidatePath = vi.fn();
  let originalNextRuntime: string | undefined;
  let consoleErrorSpy: any;

  beforeEach(() => {
    globalThis.storyCache = new Map();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    originalNextRuntime = process.env.NEXT_RUNTIME;
  });

  afterEach(() => {
    process.env.NEXT_RUNTIME = originalNextRuntime;
    consoleErrorSpy.mockRestore();
    vi.resetModules();
  });

  it('should log an error if story or pathToRevalidate is not provided', async () => {
    await liveEditUpdateAction({ story: null, pathToRevalidate: '/path' });
    expect(consoleErrorSpy).toHaveBeenCalledWith('liveEditUpdateAction: story or pathToRevalidate is not provided');

    await liveEditUpdateAction({ story: { uuid: '123' }, pathToRevalidate: null });
    expect(consoleErrorSpy).toHaveBeenCalledWith('liveEditUpdateAction: story or pathToRevalidate is not provided');
  });

  it('should set the story in the global storyCache', async () => {
    const story = { uuid: '123' };
    await liveEditUpdateAction({ story, pathToRevalidate: '/path' });
    expect(globalThis.storyCache.get('123')).toBe(story);
  });

  it('should replace existing story in the cache if it already exists', async () => {
    const oldStory = { uuid: '123', content: { old: true } };
    const newStory = { uuid: '123', content: { new: true } };

    globalThis.storyCache.set('123', oldStory);
    expect(globalThis.storyCache.get('123')).toBe(oldStory);

    await liveEditUpdateAction({ story: newStory, pathToRevalidate: '/path' });
    expect(globalThis.storyCache.get('123')).toBe(newStory);
    expect(globalThis.storyCache.get('123')).not.toBe(oldStory);
  });

  it('should cache under the provided cacheKey when given', async () => {
    const story = { id: 42, content: { headline: 'historic' } };
    await liveEditUpdateAction({ story, pathToRevalidate: '/path', cacheKey: 'id:42' });
    expect(globalThis.storyCache.get('id:42')).toBe(story);
    // uuid is undefined, so it must not be written under the uuid
    expect(globalThis.storyCache.has('undefined')).toBe(false);
  });

  it('should skip caching when both cacheKey and story.uuid are missing', async () => {
    const story = { id: 99, content: {} };
    const before = globalThis.storyCache.size;
    await liveEditUpdateAction({ story, pathToRevalidate: '/path' });
    expect(globalThis.storyCache.size).toBe(before);
    expect(globalThis.storyCache.has('undefined')).toBe(false);
  });

  it('should attempt to revalidate path when in Next.js environment', async () => {
    // Mock Next.js environment
    process.env.NEXT_RUNTIME = 'nodejs';

    // Mock the next/cache import using a local mock to ensure it works
    vi.doMock('next/cache', async () => {
      return { revalidatePath: mockRevalidatePath };
    });

    // Re-import the module to use the mocked version
    const { liveEditUpdateAction: actionWithMocks } = await import('../rsc/live-edit-update-action');

    const story = { uuid: '123' };
    await actionWithMocks({ story, pathToRevalidate: '/test-path' });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/test-path');
  });

  it('should revalidate path for history events keyed by cacheKey', async () => {
    process.env.NEXT_RUNTIME = 'nodejs';

    vi.doMock('next/cache', async () => {
      return { revalidatePath: mockRevalidatePath };
    });

    const { liveEditUpdateAction: actionWithMocks } = await import('../rsc/live-edit-update-action');

    const story = { id: 7, content: { headline: 'history' } };
    await actionWithMocks({ story, pathToRevalidate: '/vh-path', cacheKey: 'id:7' });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/vh-path');
    expect(globalThis.storyCache.get('id:7')).toBe(story);
  });

  it('should catch and log errors during revalidation', async () => {
    // Mock Next.js environment
    process.env.NEXT_RUNTIME = 'nodejs';

    // Mock a failing next/cache import
    const mockFailingRevalidate = vi.fn(() => {
      throw new Error('Revalidation failed');
    });

    vi.doMock('next/cache', async () => {
      return { revalidatePath: mockFailingRevalidate };
    });

    // Re-import the module to use the mocked version
    const { liveEditUpdateAction: actionWithMocks } = await import('../rsc/live-edit-update-action');

    const story = { uuid: '456' };
    await actionWithMocks({ story, pathToRevalidate: '/path' });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'liveEditUpdateAction: error while revalidating path',
      expect.any(Error),
    );

    // Verify the story was still cached despite the revalidation error
    expect(globalThis.storyCache.get('456')).toBe(story);
  });
});
