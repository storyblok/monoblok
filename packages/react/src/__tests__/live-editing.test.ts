import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import React from 'react';
import type { ISbStoryData } from '@storyblok/js';
import { loadStoryblokBridge, registerStoryblokBridge } from '@storyblok/js';

import StoryblokLiveEditing from '../rsc/live-editing';
import type { LiveEditRenderProps } from '../rsc/live-edit-props';
import { type LiveEditRenderResult, renderLiveEditStory } from '../rsc/live-edit-render-action';
import { isBridgeLoaded, isVisualEditor } from '../utils';

vi.mock('@storyblok/js', () => ({
  registerStoryblokBridge: vi.fn(),
  loadStoryblokBridge: vi.fn(() => Promise.resolve()),
}));

vi.mock('../rsc/live-edit-render-action', () => ({
  renderLiveEditStory: vi.fn(),
}));

vi.mock('../utils', () => ({
  isVisualEditor: vi.fn(() => false),
  isBridgeLoaded: vi.fn(() => false),
}));

type RenderAction = (input: unknown) => Promise<LiveEditRenderResult>;

const STORY = { id: 10, uuid: 'uuid-10' } as ISbStoryData;
// Bridge registrations are per story id and page-wide, so every test uses its own id.
let nextStoryId = 1000;
const incoming = (label: string) =>
  ({ id: 10, content: { _uid: 'x', component: 'page', label } }) as unknown as ISbStoryData;

const rendered = (label: string): LiveEditRenderResult => ({
  ok: true,
  node: React.createElement('p', { 'data-testid': 'content' }, label),
});

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

const serverOutput = () => React.createElement('p', { 'data-testid': 'content' }, 'server');

const DEFAULT_PROPS: LiveEditRenderProps = { className: 'hero' };

const liveEditing = (
  storyId: number,
  renderAction?: RenderAction,
  /** `null` renders it the way a standalone setup does, without props. */
  renderProps: LiveEditRenderProps | null = DEFAULT_PROPS,
) =>
  React.createElement(
    StoryblokLiveEditing,
    {
      story: { id: storyId } as ISbStoryData,
      bridgeOptions: {},
      renderAction,
      renderProps: renderProps ?? undefined,
    },
    serverOutput(),
  );

const renderLiveEditing = async (
  renderAction?: RenderAction,
  /** `null` renders it the way a standalone setup does, without props. */
  renderProps: LiveEditRenderProps | null = DEFAULT_PROPS,
) => {
  let listener: ((story: ISbStoryData) => void) | null = null;
  vi.mocked(registerStoryblokBridge).mockImplementation((_id, cb) => {
    listener = cb;
  });
  const result = render(liveEditing(nextStoryId++, renderAction, renderProps));
  await vi.waitFor(() => expect(listener).not.toBeNull());
  const emit = (story: ISbStoryData) =>
    act(async () => {
      listener!(story);
    });
  return { ...result, emit };
};

describe('storyblokLiveEditing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isVisualEditor).mockReturnValue(true);
    vi.mocked(isBridgeLoaded).mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the server output and skips the bridge outside the Visual Editor', () => {
    vi.mocked(isVisualEditor).mockReturnValue(false);
    vi.mocked(isBridgeLoaded).mockReturnValue(false);

    const { getByTestId } = render(
      React.createElement(StoryblokLiveEditing, { story: STORY }, serverOutput()),
    );

    expect(getByTestId('content').textContent).toBe('server');
    expect(loadStoryblokBridge).not.toHaveBeenCalled();
    expect(registerStoryblokBridge).not.toHaveBeenCalled();
  });

  it('loads the bridge when it isn\'t loaded yet', async () => {
    vi.mocked(isBridgeLoaded).mockReturnValue(false);

    await renderLiveEditing(vi.fn());

    expect(loadStoryblokBridge).toHaveBeenCalled();
  });

  it('renders the server action\'s result for a Visual Editor change', async () => {
    const renderAction = vi.fn<RenderAction>(async () => rendered('live'));
    const { getByTestId, emit } = await renderLiveEditing(renderAction);

    await emit(incoming('live'));

    await vi.waitFor(() => expect(getByTestId('content').textContent).toBe('live'));
  });

  it('sends only the story content and the primitive props to the server', async () => {
    const renderAction = vi.fn<RenderAction>(async () => rendered('live'));
    const { emit } = await renderLiveEditing(renderAction);

    await emit({ ...incoming('live'), name: 'Home', full_slug: 'home' });

    expect(renderAction).toHaveBeenCalledWith({
      story: { content: incoming('live').content },
      props: { className: 'hero' },
    });
  });

  it('keeps the current render for Visual History events without content', async () => {
    const renderAction = vi.fn<RenderAction>(async () => rendered('live'));
    const { emit } = await renderLiveEditing(renderAction);

    await emit({ id: 10 } as ISbStoryData);

    expect(renderAction).not.toHaveBeenCalled();
  });

  it('sends one request at a time and renders only the latest queued story', async () => {
    const first = deferred<LiveEditRenderResult>();
    const renderAction = vi
      .fn<RenderAction>()
      .mockReturnValueOnce(first.promise)
      .mockImplementation(async () => rendered('c'));
    const { getByTestId, emit } = await renderLiveEditing(renderAction);

    await emit(incoming('a'));
    await emit(incoming('b'));
    await emit(incoming('c'));
    expect(renderAction).toHaveBeenCalledTimes(1);

    await act(async () => first.resolve(rendered('a')));

    await vi.waitFor(() => expect(getByTestId('content').textContent).toBe('c'));
    expect(renderAction).toHaveBeenCalledTimes(2);
    expect(renderAction.mock.calls[1][0]).toMatchObject({ story: { content: { label: 'c' } } });
  });

  it('stops retrying a change after a bounded number of cold instances', async () => {
    const renderAction = vi
      .fn<RenderAction>()
      .mockResolvedValueOnce({ ok: false, retry: true })
      .mockResolvedValueOnce({ ok: false, retry: true })
      .mockResolvedValueOnce({ ok: false, retry: true })
      .mockResolvedValueOnce({ ok: false, retry: true })
      .mockImplementation(async () => rendered('live'));
    const { getByTestId, emit } = await renderLiveEditing(renderAction);

    await emit(incoming('live'));

    // The first attempt plus three retries, not a loop.
    await vi.waitFor(() => expect(renderAction).toHaveBeenCalledTimes(4));
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(renderAction).toHaveBeenCalledTimes(4);
    expect(renderAction.mock.calls[3][0]).toEqual(renderAction.mock.calls[0][0]);
    expect(getByTestId('content').textContent).toBe('server');

    // The next change gets its own retries.
    await emit(incoming('next'));
    await vi.waitFor(() => expect(getByTestId('content').textContent).toBe('live'));
  });

  it('retries again after a successful render, for a later cold instance', async () => {
    const renderAction = vi
      .fn<RenderAction>()
      .mockResolvedValueOnce({ ok: false, retry: true })
      .mockResolvedValueOnce(rendered('first'))
      .mockResolvedValueOnce({ ok: false, retry: true })
      .mockImplementation(async () => rendered('second'));
    const { getByTestId, emit } = await renderLiveEditing(renderAction);

    await emit(incoming('first'));
    await vi.waitFor(() => expect(getByTestId('content').textContent).toBe('first'));

    await emit(incoming('second'));
    await vi.waitFor(() => expect(getByTestId('content').textContent).toBe('second'));
    expect(renderAction).toHaveBeenCalledTimes(4);
  });

  it('keeps the current render when the server can\'t render the story', async () => {
    const renderAction = vi.fn<RenderAction>(async () => ({ ok: false }));
    const { getByTestId, emit } = await renderLiveEditing(renderAction);

    await emit(incoming('live'));

    await vi.waitFor(() => expect(renderAction).toHaveBeenCalled());
    expect(getByTestId('content').textContent).toBe('server');
  });

  it('keeps the current render and warns when the server action fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { getByTestId, emit } = await renderLiveEditing(
      vi.fn<RenderAction>(async () => {
        throw new Error('network');
      }),
    );

    await emit(incoming('live'));

    await vi.waitFor(() => expect(warnSpy).toHaveBeenCalled());
    expect(getByTestId('content').textContent).toBe('server');
  });

  it('ignores bridge events after unmount', async () => {
    const renderAction = vi.fn<RenderAction>(async () => rendered('live'));
    const { unmount, emit } = await renderLiveEditing(renderAction);

    unmount();
    await emit(incoming('live'));

    expect(renderAction).not.toHaveBeenCalled();
  });

  it('registers the bridge once per story and routes events to the current mount', async () => {
    // React Strict Mode mounts, unmounts and remounts. The bridge only calls the
    // first listener registered on the page, so a second registration would
    // never fire and the first one belongs to the unmounted component.
    let listener: ((story: ISbStoryData) => void) | null = null;
    vi.mocked(registerStoryblokBridge).mockImplementation((_id, cb) => {
      listener ??= cb;
    });
    const storyId = nextStoryId++;
    const first = vi.fn<RenderAction>(async () => rendered('first'));
    const second = vi.fn<RenderAction>(async () => rendered('second'));

    const { unmount } = render(liveEditing(storyId, first));
    await vi.waitFor(() => expect(listener).not.toBeNull());
    unmount();
    const { getByTestId } = render(liveEditing(storyId, second));
    await vi.waitFor(() => expect(registerStoryblokBridge).toHaveBeenCalledTimes(1));
    await act(async () => {
      listener!(incoming('live'));
    });

    await vi.waitFor(() => expect(getByTestId('content').textContent).toBe('second'));
    expect(first).not.toHaveBeenCalled();
  });

  it('loads the live editing Server Action lazily when none is passed', async () => {
    vi.mocked(renderLiveEditStory).mockImplementation(async () => rendered('lazy'));
    const { getByTestId, emit } = await renderLiveEditing(undefined);

    await emit(incoming('live'));

    await vi.waitFor(() => expect(getByTestId('content').textContent).toBe('lazy'));
    expect(renderLiveEditStory).toHaveBeenCalledWith({
      story: { content: incoming('live').content },
      props: DEFAULT_PROPS,
    });
  });

  it('warns once and keeps the server render when used on its own', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { getByTestId, emit } = await renderLiveEditing(undefined, null);

    await emit(incoming('a'));
    await emit(incoming('b'));

    expect(renderLiveEditStory).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(getByTestId('content').textContent).toBe('server');
  });

  it('falls back to the server render and warns when the live render throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const Throws = () => {
      throw new Error('settings is undefined');
    };
    const renderAction = vi.fn<RenderAction>(async () => ({
      ok: true,
      node: React.createElement(Throws),
    }));
    const { getByTestId, emit } = await renderLiveEditing(renderAction);

    await emit(incoming('live'));

    await vi.waitFor(() => expect(warnSpy).toHaveBeenCalled());
    expect(getByTestId('content').textContent).toBe('server');

    // The next change renders live again.
    renderAction.mockImplementation(async () => rendered('fixed'));
    await emit(incoming('fixed'));
    await vi.waitFor(() => expect(getByTestId('content').textContent).toBe('fixed'));
  });

  it('shows the new story\'s server render when the story changes in place', async () => {
    let listener: ((story: ISbStoryData) => void) | null = null;
    vi.mocked(registerStoryblokBridge).mockImplementation((_id, cb) => {
      listener = cb;
    });
    const renderAction = vi.fn<RenderAction>(async () => rendered('A-live'));
    const a = nextStoryId++;
    const b = nextStoryId++;
    const view = (id: number, label: string) =>
      React.createElement(
        StoryblokLiveEditing,
        { story: { id } as ISbStoryData, renderAction, renderProps: DEFAULT_PROPS },
        React.createElement('p', { 'data-testid': 'content' }, label),
      );
    const { getByTestId, rerender } = render(view(a, 'A'));
    await vi.waitFor(() => expect(listener).not.toBeNull());
    await act(async () => listener!(incoming('A-live')));
    await vi.waitFor(() => expect(getByTestId('content').textContent).toBe('A-live'));

    rerender(view(b, 'B'));

    expect(getByTestId('content').textContent).toBe('B');
  });

  it('retries more than once while the server keeps landing on cold instances', async () => {
    const renderAction = vi
      .fn<RenderAction>()
      .mockResolvedValueOnce({ ok: false, retry: true })
      .mockResolvedValueOnce({ ok: false, retry: true })
      .mockImplementation(async () => rendered('live'));
    const { getByTestId, emit } = await renderLiveEditing(renderAction);

    await emit(incoming('live'));

    await vi.waitFor(() => expect(getByTestId('content').textContent).toBe('live'));
  });

  it('warns once about props left out of the live render', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let listener: ((story: ISbStoryData) => void) | null = null;
    vi.mocked(registerStoryblokBridge).mockImplementation((_id, cb) => {
      listener = cb;
    });
    render(
      React.createElement(
        StoryblokLiveEditing,
        {
          story: { id: nextStoryId++ } as ISbStoryData,
          renderAction: vi.fn<RenderAction>(async () => rendered('live')),
          renderProps: DEFAULT_PROPS,
          omittedRenderProps: ['settings'],
        },
        serverOutput(),
      ),
    );
    await vi.waitFor(() => expect(listener).not.toBeNull());

    await act(async () => listener!(incoming('a')));
    await act(async () => listener!(incoming('b')));

    const omittedWarnings = warnSpy.mock.calls.filter(args =>
      String(args[0]).includes('settings'),
    );
    expect(omittedWarnings).toHaveLength(1);
  });

  it('warns once and keeps the server render when the action runs in the browser', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const renderAction = vi.fn<RenderAction>(async () => ({ ok: false, unsupported: true }));
    const { getByTestId, emit } = await renderLiveEditing(renderAction);

    await emit(incoming('a'));
    await vi.waitFor(() => expect(renderAction).toHaveBeenCalledTimes(1));
    await emit(incoming('b'));
    await vi.waitFor(() => expect(renderAction).toHaveBeenCalledTimes(2));

    const unsupportedWarnings = warnSpy.mock.calls.filter(args =>
      String(args[0]).includes('Next.js 14'),
    );
    expect(unsupportedWarnings).toHaveLength(1);
    expect(getByTestId('content').textContent).toBe('server');
  });
});
