import { beforeEach, describe, expect, it, vi } from 'vitest';

import { isBrowser } from './utils/isBrowser';
import { isInEditor } from './utils/isInEditor';

// ---- mocks ----

vi.mock('./utils/isBrowser', () => ({
  isBrowser: vi.fn(),
}));

vi.mock('./utils/isInEditor', () => ({
  isInEditor: vi.fn(),
}));

const onMock = vi.fn();

const mockBridge = {
  on: onMock,
};

vi.mock('./loadStoryblokBridge', () => ({
  loadStoryblokBridge: vi.fn(async () => mockBridge),
}));

describe('onStoryblokEditorEvent', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    Object.defineProperty(window, 'location', {
      value: { reload: vi.fn(), href: 'http://localhost/' },
      writable: true,
    });
  });

  async function loadModule() {
    return await import('./onStoryblokEditorEvent');
  }

  it('does nothing when not in browser', async () => {
    vi.mocked(isBrowser).mockReturnValue(false);
    vi.mocked(isInEditor).mockReturnValue(true);

    const { onStoryblokEditorEvent } = await loadModule();

    await onStoryblokEditorEvent(vi.fn(), {});

    expect(onMock).not.toHaveBeenCalled();
  });

  it('does nothing when not in editor', async () => {
    vi.mocked(isBrowser).mockReturnValue(true);
    vi.mocked(isInEditor).mockReturnValue(false);

    const { onStoryblokEditorEvent } = await loadModule();

    await onStoryblokEditorEvent(vi.fn(), {});

    expect(onMock).not.toHaveBeenCalled();
  });

  it('initializes bridge only once', async () => {
    vi.mocked(isBrowser).mockReturnValue(true);
    vi.mocked(isInEditor).mockReturnValue(true);

    const { onStoryblokEditorEvent } = await loadModule();

    await onStoryblokEditorEvent(vi.fn(), {});
    await onStoryblokEditorEvent(vi.fn(), {});

    expect(onMock).toHaveBeenCalledOnce();
  });

  it('calls callback on input event', async () => {
    vi.mocked(isBrowser).mockReturnValue(true);
    vi.mocked(isInEditor).mockReturnValue(true);

    const { onStoryblokEditorEvent } = await loadModule();

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

  it('notifies multiple listeners', async () => {
    vi.mocked(isBrowser).mockReturnValue(true);
    vi.mocked(isInEditor).mockReturnValue(true);

    const { onStoryblokEditorEvent } = await loadModule();

    const cb1 = vi.fn();
    const cb2 = vi.fn();

    await onStoryblokEditorEvent(cb1, {});
    await onStoryblokEditorEvent(cb2, {});

    const handler = onMock.mock.calls[0][1];

    handler({
      action: 'input',
      story: { id: 100 },
    });

    expect(cb1).toHaveBeenCalled();
    expect(cb2).toHaveBeenCalled();
  });

  it('cleanup removes listener', async () => {
    vi.mocked(isBrowser).mockReturnValue(true);
    vi.mocked(isInEditor).mockReturnValue(true);

    const { onStoryblokEditorEvent } = await loadModule();

    const cb = vi.fn();

    const cleanup = await onStoryblokEditorEvent(cb, {});

    cleanup();

    const handler = onMock.mock.calls[0][1];

    handler({
      action: 'input',
      story: { id: 1 },
    });

    expect(cb).not.toHaveBeenCalled();
  });

  it('reloads page on change event', async () => {
    vi.mocked(isBrowser).mockReturnValue(true);
    vi.mocked(isInEditor).mockReturnValue(true);

    const { onStoryblokEditorEvent } = await loadModule();

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

    const { onStoryblokEditorEvent } = await loadModule();

    await onStoryblokEditorEvent(vi.fn(), {});

    const handler = onMock.mock.calls[0][1];

    handler({
      action: 'published',
      story: { id: 42 },
    });

    expect(window.location.reload).toHaveBeenCalledOnce();
  });

  it('does not register duplicate handlers during concurrent calls', async () => {
    vi.mocked(isBrowser).mockReturnValue(true);
    vi.mocked(isInEditor).mockReturnValue(true);

    const { onStoryblokEditorEvent } = await loadModule();

    await Promise.all([
      onStoryblokEditorEvent(vi.fn(), {}),
      onStoryblokEditorEvent(vi.fn(), {}),
      onStoryblokEditorEvent(vi.fn(), {}),
    ]);

    expect(onMock).toHaveBeenCalledOnce();
  });
});
