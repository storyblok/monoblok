import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import type { ISbStoryData } from '@storyblok/js';

// Import after mocks
import StoryblokLiveEditing from '../rsc/live-editing';
import { isBridgeLoaded, isVisualEditor } from '../utils';
import { loadStoryblokBridge } from '@storyblok/js';

// Mock dependencies - need to define functions inline to avoid hoisting issues
vi.mock('../rsc/live-edit-update-action', () => ({
  liveEditUpdateAction: vi.fn(),
}));

vi.mock('@storyblok/js', () => ({
  registerStoryblokBridge: vi.fn(),
  loadStoryblokBridge: vi.fn(() => Promise.resolve()),
}));

vi.mock('../utils', () => ({
  isVisualEditor: vi.fn(() => false),
  isBridgeLoaded: vi.fn(() => false),
}));

describe('storyblokLiveEditing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isVisualEditor).mockReturnValue(false);
    vi.mocked(isBridgeLoaded).mockReturnValue(false);

    // Mock window
    vi.stubGlobal('window', {
      storyblokRegisterEvent: undefined,
      location: {
        search: '',
        pathname: '/',
      },
      self: {},
      top: {},
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return null when not in visual editor', () => {
    vi.mocked(isVisualEditor).mockReturnValue(false);

    const { container } = render(
      React.createElement(StoryblokLiveEditing, {
        story: { uuid: '123', id: 456 } as ISbStoryData,
        bridgeOptions: {},
      }),
    );

    expect(container.firstChild).toBeNull();
    expect(loadStoryblokBridge).not.toHaveBeenCalled();
  });

  it('should load bridge and register when in visual editor', async () => {
    vi.mocked(isVisualEditor).mockReturnValue(true);
    vi.mocked(isBridgeLoaded).mockReturnValue(false);

    const story = { id: 789, uuid: 'test-uuid' } as ISbStoryData;

    const { container } = render(
      React.createElement(StoryblokLiveEditing, {
        story,
        bridgeOptions: { resolveRelations: ['test.relation'] },
      }),
    );

    // Component should return null but load bridge
    expect(container.firstChild).toBeNull();

    // Wait for async bridge loading
    await vi.waitFor(() => {
      expect(loadStoryblokBridge).toHaveBeenCalled();
    });
  });

  it('should handle null story gracefully', () => {
    vi.mocked(isVisualEditor).mockReturnValue(false);

    const { container } = render(
      React.createElement(StoryblokLiveEditing, {
        // @ts-expect-error - Testing invalid input
        story: null,
        bridgeOptions: {},
      }),
    );

    expect(container.firstChild).toBeNull();
  });

  it('should not load bridge when already loaded', () => {
    vi.mocked(isVisualEditor).mockReturnValue(true);
    vi.mocked(isBridgeLoaded).mockReturnValue(true);

    render(
      React.createElement(StoryblokLiveEditing, {
        story: { id: 123, uuid: 'test' } as ISbStoryData,
        bridgeOptions: {},
      }),
    );

    // Since bridge is already loaded, we should not call loadStoryblokBridge
    expect(loadStoryblokBridge).not.toHaveBeenCalled();
  });
});
