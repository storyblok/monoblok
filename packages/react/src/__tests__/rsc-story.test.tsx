import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import type { ISbStoryData } from '@storyblok/js';

import StoryblokStory from '../rsc/story';
import { setComponents } from '../core/state';

// StoryblokLiveEditing registers the bridge on mount; for rendering tests we
// keep `isVisualEditor` falsy so it short-circuits to `return null`.
vi.mock('../utils', async () => {
  const actual = await vi.importActual<typeof import('../utils')>('../utils');
  return {
    ...actual,
    isVisualEditor: vi.fn(() => false),
    isBridgeLoaded: vi.fn(() => false),
  };
});

vi.mock('@storyblok/js', () => ({
  registerStoryblokBridge: vi.fn(),
  loadStoryblokBridge: vi.fn(() => Promise.resolve()),
}));

function Marker({ blok }: { blok: { label?: string } }) {
  return <span data-testid="marker">{blok?.label ?? 'no-label'}</span>;
}

describe('storyblokStory cache lookup', () => {
  beforeEach(() => {
    globalThis.storyCache = new Map();
    setComponents({ marker: Marker });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the uuid-keyed cached story and clears the uuid entry', () => {
    const server = { id: 1, uuid: 'u-1', content: { component: 'marker', label: 'server' } } as unknown as ISbStoryData;
    const cached = { id: 1, uuid: 'u-1', content: { component: 'marker', label: 'cached' } } as unknown as ISbStoryData;
    globalThis.storyCache.set('u-1', cached);

    const { getByTestId } = render(<StoryblokStory story={server} />);

    expect(getByTestId('marker').textContent).toBe('cached');
    expect(globalThis.storyCache.has('u-1')).toBe(false);
  });

  it('falls back to the id-index when uuid miss, merging payload onto server story', () => {
    const server = {
      id: 42,
      uuid: 'u-draft',
      slug: 'home',
      full_slug: 'home',
      content: { component: 'marker', label: 'draft' },
    } as unknown as ISbStoryData;
    const historyPayload = {
      id: 42,
      content: { component: 'marker', label: 'history' },
    } as unknown as ISbStoryData;
    globalThis.storyCache.set('id:42', historyPayload);

    const { getByTestId } = render(<StoryblokStory story={server} />);

    expect(getByTestId('marker').textContent).toBe('history');
    expect(globalThis.storyCache.has('id:42')).toBe(false);
  });

  it('renders the server story when no cache entry matches', () => {
    const server = { id: 7, uuid: 'u-7', content: { component: 'marker', label: 'only-draft' } } as unknown as ISbStoryData;

    const { getByTestId } = render(<StoryblokStory story={server} />);

    expect(getByTestId('marker').textContent).toBe('only-draft');
  });

  it('prefers the uuid entry over an id-index entry when both exist', () => {
    const server = { id: 9, uuid: 'u-9', content: { component: 'marker', label: 'draft' } } as unknown as ISbStoryData;
    const uuidHit = { id: 9, uuid: 'u-9', content: { component: 'marker', label: 'by-uuid' } } as unknown as ISbStoryData;
    const idHit = { id: 9, content: { component: 'marker', label: 'by-id' } } as unknown as ISbStoryData;
    globalThis.storyCache.set('u-9', uuidHit);
    globalThis.storyCache.set('id:9', idHit);

    const { getByTestId } = render(<StoryblokStory story={server} />);

    expect(getByTestId('marker').textContent).toBe('by-uuid');
    // Both entries are cleared so a stale id-index payload can't replay later.
    expect(globalThis.storyCache.has('u-9')).toBe(false);
    expect(globalThis.storyCache.has('id:9')).toBe(false);
  });

  it('clears a stale id-index entry even when no cache hit occurs', () => {
    // Simulates a later render (no fresh bridge event) where a previous uuid
    // consumption left an older Visual History payload behind.
    const server = { id: 11, uuid: 'u-11', content: { component: 'marker', label: 'draft' } } as unknown as ISbStoryData;
    const staleHistory = { id: 11, content: { component: 'marker', label: 'stale-history' } } as unknown as ISbStoryData;
    globalThis.storyCache.set('id:11', staleHistory);

    const { getByTestId, rerender } = render(<StoryblokStory story={server} />);
    // First render merges the stale history payload but consumes the entry.
    expect(getByTestId('marker').textContent).toBe('stale-history');
    expect(globalThis.storyCache.has('id:11')).toBe(false);

    // Second render without any fresh cache entry renders the server story.
    rerender(<StoryblokStory story={server} />);
    expect(getByTestId('marker').textContent).toBe('draft');
  });
});
