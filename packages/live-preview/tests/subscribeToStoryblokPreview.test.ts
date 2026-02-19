import { describe, it, expect, vi, beforeEach } from 'vitest';
import { subscribeToStoryblokPreview } from '../src/subscribeToStoryblokPreview';

// ---- mocks ----

vi.mock('../src/utils/isBrowser', () => ({
  isBrowser: vi.fn(),
}));

vi.mock('../src/utils/isInEditor', () => ({
  isInEditor: vi.fn(),
}));

const onMock = vi.fn();

vi.mock('@storyblok/preview-bridge', () => {
  class MockStoryblokBridge {
    on = onMock;
  }
  return {
    default: MockStoryblokBridge,
  };
});

import { isBrowser } from '../src/utils/isBrowser';
import { isInEditor } from '../src/utils/isInEditor';

describe('onStoryChange', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // jsdom-safe reload mock
    Object.defineProperty(window, 'location', {
      value: { reload: vi.fn(), href: 'http://localhost/' },
      writable: true,
    });
  });

  it('does nothing when not in browser', async () => {
    vi.mocked(isBrowser).mockReturnValue(false);

    await subscribeToStoryblokPreview(1, vi.fn(), {});

    expect(onMock).not.toHaveBeenCalled();
  });

  it('does nothing when not in editor', async () => {
    vi.mocked(isBrowser).mockReturnValue(true);
    vi.mocked(isInEditor).mockReturnValue(false);

    await subscribeToStoryblokPreview(1, vi.fn(), {});

    expect(onMock).not.toHaveBeenCalled();
  });

  it('registers bridge listener in editor', async () => {
    vi.mocked(isBrowser).mockReturnValue(true);
    vi.mocked(isInEditor).mockReturnValue(true);

    await subscribeToStoryblokPreview(1, vi.fn(), {});

    expect(onMock).toHaveBeenCalledOnce();
    expect(onMock).toHaveBeenCalledWith(
      ['input', 'change', 'published'],
      expect.any(Function),
    );
  });

  it('calls callback on input event for matching story', async () => {
    vi.mocked(isBrowser).mockReturnValue(true);
    vi.mocked(isInEditor).mockReturnValue(true);

    const cb = vi.fn();

    await subscribeToStoryblokPreview(42, cb, {});

    const handler = onMock.mock.calls[0][1];

    handler({
      action: 'input',
      story: { id: 42, content: { title: 'Hello' } },
    });

    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 42,
      }),
    );
  });

  it('reloads page on change event for matching story', async () => {
    vi.mocked(isBrowser).mockReturnValue(true);
    vi.mocked(isInEditor).mockReturnValue(true);

    await subscribeToStoryblokPreview(42, vi.fn(), {});

    const handler = onMock.mock.calls[0][1];

    handler({
      action: 'change',
      storyId: 42,
    });

    expect(window.location.reload).toHaveBeenCalledOnce();
  });
});
