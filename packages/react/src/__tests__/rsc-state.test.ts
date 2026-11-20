import { afterEach, describe, expect, it, vi } from 'vitest';

const RSC_RENDER_STATE_KEY = Symbol.for('@storyblok/react/rsc-render-state');
const Marker = () => null;

const loadStateInstance = async () => {
  vi.resetModules();
  return import('../rsc/state');
};

const loadCommonInstance = async () => {
  vi.resetModules();
  return import('../rsc/common');
};

describe('component registry across module instances', () => {
  afterEach(() => {
    vi.doUnmock('react');
    vi.resetModules();
    Reflect.deleteProperty(globalThis, RSC_RENDER_STATE_KEY);
  });

  it('is shared under react-server, where the live edit action renders', async () => {
    // The `react-server` build has no `useState`.
    vi.doMock('react', () => ({ createElement: () => null, forwardRef: (render: unknown) => render, useState: undefined }));
    const pageRender = await loadCommonInstance();
    const serverAction = await loadStateInstance();

    pageRender.storyblokInit({ components: { marker: Marker }, enableFallbackComponent: true });

    expect(serverAction.isReactServerEnvironment()).toBe(true);
    expect(serverAction.getComponent('marker')).toBe(Marker);
    expect(serverAction.getEnableFallbackComponent()).toBe(true);
  });

  it('stays per instance in SSR and the browser', async () => {
    const first = await loadStateInstance();
    const second = await loadStateInstance();

    first.setComponents({ marker: Marker });

    expect(second.isReactServerEnvironment()).toBe(false);
    expect(second.getComponentsMap().has('marker')).toBe(false);
    expect(Reflect.has(globalThis, RSC_RENDER_STATE_KEY)).toBe(false);
  });
});
