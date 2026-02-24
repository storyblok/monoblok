import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onStoryblokEditorEvent } from './onStoryblokEditorEvent';

import { isBrowser } from '../src/utils/isBrowser';
import { isInEditor } from '../src/utils/isInEditor';

// ---- mocks ----

vi.mock('../src/utils/isBrowser', () => ({
  isBrowser: vi.fn(),
}));

vi.mock('../src/utils/isInEditor', () => ({
  isInEditor: vi.fn(),
}));

const onMock = vi.fn();

// SINGLE bridge instance
const mockBridge = {
  on: onMock,
};

vi.mock('./loadStoryblokBridge', () => ({
  loadStoryblokBridge: vi.fn(async () => mockBridge),
}));

describe('onStoryblokEditorEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(window, 'location', {
      value: { reload: vi.fn(), href: 'http://localhost/' },
      writable: true,
    });
  });

  it('does nothing when not in browser', async () => {
    vi.mocked(isBrowser).mockReturnValue(false);
    vi.mocked(isInEditor).mockReturnValue(true);

    await onStoryblokEditorEvent(vi.fn(), {});

    expect(onMock).not.toHaveBeenCalled();
  });

  it('does nothing when not in editor', async () => {
    vi.mocked(isBrowser).mockReturnValue(true);
    vi.mocked(isInEditor).mockReturnValue(false);

    await onStoryblokEditorEvent(vi.fn(), {});

    expect(onMock).not.toHaveBeenCalled();
  });

  it('registers bridge listener in editor', async () => {
    vi.mocked(isBrowser).mockReturnValue(true);
    vi.mocked(isInEditor).mockReturnValue(true);

    await onStoryblokEditorEvent(vi.fn(), {});

    expect(onMock).toHaveBeenCalledOnce();
    expect(onMock).toHaveBeenCalledWith(
      ['input', 'change', 'published'],
      expect.any(Function),
    );
  });

  it('calls callback on input event', async () => {
    vi.mocked(isBrowser).mockReturnValue(true);
    vi.mocked(isInEditor).mockReturnValue(true);

    const cb = vi.fn();

    await onStoryblokEditorEvent(cb, {});

    const handler = onMock.mock.calls[0][1];

    handler({
      action: 'input',
      story: { id: 42, content: { title: 'Hello' } },
    });

    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ id: 42 }),
    );
  });

  it('reloads page on change event', async () => {
    vi.mocked(isBrowser).mockReturnValue(true);
    vi.mocked(isInEditor).mockReturnValue(true);

    await onStoryblokEditorEvent(vi.fn(), {});

    const handler = onMock.mock.calls[0][1];

    handler({
      action: 'change',
      story: { id: 42 },
    });

    expect(window.location.reload).toHaveBeenCalledOnce();
  });

  it('reloads page on published event', async () => {
    vi.mocked(isBrowser).mockReturnValue(true);
    vi.mocked(isInEditor).mockReturnValue(true);

    await onStoryblokEditorEvent(vi.fn(), {});

    const handler = onMock.mock.calls[0][1];

    handler({
      action: 'published',
      story: { id: 42 },
    });

    expect(window.location.reload).toHaveBeenCalledOnce();
  });
});
