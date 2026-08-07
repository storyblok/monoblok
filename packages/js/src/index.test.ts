import {
  apiPlugin,
  renderRichText,
  storyblokEditable,
  storyblokInit,
  useStoryblokBridge,
} from '../src';
import type { SbInitResult, SbPluginFactory, SbRichTextDoc } from '../src';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadBridge } from './bridge';

// Mock @storyblok/preview-bridge so dynamic import() in bridge.ts resolves
// synchronously in tests without triggering any real browser bridge logic.
const MockStoryblokBridge = vi.fn();
vi.mock('@storyblok/preview-bridge', () => ({
  default: MockStoryblokBridge,
}));

/** Flush all pending microtasks (lets the dynamic import .then() chains run). */
async function flushPromises() {
  await new Promise(resolve => setTimeout(resolve, 0));
}

describe('@storyblok/js', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('api', () => {
    it('is not loaded by default', () => {
      const result = storyblokInit({
        accessToken: 'TEST_TOKEN',
      });

      expect(result).toEqual({});
    });

    it('is loaded correctly when using the apiPlugin', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(JSON.stringify({
          stories: [
            { id: 1, name: 'Story 1' },
            { id: 2, name: 'Story 2' },
            { id: 3, name: 'Story 3' },
          ],
        })));

      const { storyblokApi } = storyblokInit({
        accessToken: 'TEST_TOKEN',
        use: [apiPlugin],
      });

      const result = await storyblokApi!.getAll('cdn/stories', { version: 'draft' });

      expect(result.length).toBeGreaterThan(0);
      expect(fetchSpy).toHaveBeenCalled();
    });

    it('logs an error if no access token is provided', () => {
      const spy = vi.spyOn(console, 'error');
      storyblokInit({
        accessToken: undefined,
        apiOptions: { accessToken: undefined },
        use: [apiPlugin],
      });

      expect(spy).toBeCalledWith(
        'You need to provide an access token to interact with Storyblok API. Read https://www.storyblok.com/docs/api/content-delivery#topics/authentication',
      );
    });
  });

  describe('api Plugin', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('should handle failed API calls', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockRejectedValueOnce(new Error('API Error'));

      const { storyblokApi } = storyblokInit({
        accessToken: 'test-token',
        use: [apiPlugin],
      });

      await expect(storyblokApi!.get('cdn/stories/test')).rejects.toThrow();
      expect(fetchSpy).toHaveBeenCalled();
    });

    it('should support different API endpoints', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(JSON.stringify({ stories: [] })))
        .mockResolvedValueOnce(new Response(JSON.stringify({ links: [] })))
        .mockResolvedValueOnce(new Response(JSON.stringify({ datasources: [] })));

      const { storyblokApi } = storyblokInit({
        accessToken: 'test-token',
        use: [apiPlugin],
      });

      await storyblokApi!.get('cdn/stories');
      await storyblokApi!.get('cdn/links');
      await storyblokApi!.get('cdn/datasources');

      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(fetchSpy.mock.calls[0][0].toString()).toContain('cdn/stories');
      expect(fetchSpy.mock.calls[1][0].toString()).toContain('cdn/links');
      expect(fetchSpy.mock.calls[2][0].toString()).toContain('cdn/datasources');
    });

    it('should handle pagination correctly', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(JSON.stringify({
          stories: [{ id: 1 }, { id: 2 }],
          total: 4,
          perPage: 2,
          page: 1,
        })))
        .mockResolvedValueOnce(new Response(JSON.stringify({
          stories: [{ id: 3 }, { id: 4 }],
          total: 4,
          perPage: 2,
          page: 2,
        })));

      const { storyblokApi } = storyblokInit({
        accessToken: 'test-token',
        use: [apiPlugin],
      }) as { storyblokApi: any };

      const allStories: Array<{ id: number }> = [];
      let page = 1;
      const perPage = 2;

      let response = await storyblokApi.get('cdn/stories', { page, perPage });
      const total = response.data.total;
      allStories.push(...response.data.stories);

      while (allStories.length < total) {
        page++;
        response = await storyblokApi.get('cdn/stories', { page, perPage });
        allStories.push(...response.data.stories);
      }

      expect(allStories).toHaveLength(4);
      expect(allStories).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('initialization', () => {
    it('should initialize multiple plugins', () => {
      const plugin1: SbPluginFactory = () => ({ feature1: 'value1' });
      const plugin2: SbPluginFactory = () => ({ feature2: 'value2' });

      const result = storyblokInit({
        accessToken: 'test-token',
        use: [plugin1, plugin2],
      }) as SbInitResult & { feature1: string; feature2: string };

      expect(result).toEqual({ feature1: 'value1', feature2: 'value2' });
      expect(result.feature1).toBe('value1');
      expect(result.feature2).toBe('value2');
    });

    it('should emit a deprecation warning for bridgeUrl', () => {
      const warnSpy = vi.spyOn(console, 'warn');

      storyblokInit({
        accessToken: 'test-token',
        bridgeUrl: 'https://custom-bridge.com/bridge.js',
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('bridgeUrl` option is deprecated'),
      );

      // The bridge is now bundled — no CDN script tag is injected.
      expect(document.querySelector('#storyblok-javascript-bridge')).toBeNull();
    });
  });

  describe('normalizeBridgeOptions (via useStoryblokBridge)', () => {
    const mockOn = vi.fn();

    beforeEach(() => {
      mockOn.mockClear();
      MockStoryblokBridge.mockClear();
      // Make the constructor return an object with .on() so useStoryblokBridge
      // doesn't throw when it calls sbBridge.on(...)
      MockStoryblokBridge.mockImplementation(() => ({ on: mockOn }));

      // Simulate bridge already loaded: storyblokRegisterEvent executes
      // callbacks immediately and window.StoryblokBridge is available.
      Object.defineProperty(window, 'location', {
        value: { search: '?_storyblok=42', href: 'http://localhost?_storyblok=42' },
        writable: true,
        configurable: true,
      });
      (window as any).storyblokRegisterEvent = (cb: () => void) => cb();
      (window as any).StoryblokBridge = MockStoryblokBridge;
    });

    afterEach(() => {
      delete (window as any).storyblokRegisterEvent;
      delete (window as any).StoryblokBridge;
    });

    it('normalises resolveRelations string to a single-element array', () => {
      useStoryblokBridge(42, vi.fn(), { resolveRelations: 'global-author.author' });

      expect(MockStoryblokBridge).toHaveBeenCalledWith(
        expect.objectContaining({ resolveRelations: ['global-author.author'] }),
      );
    });

    it('keeps resolveRelations array unchanged', () => {
      useStoryblokBridge(42, vi.fn(), { resolveRelations: ['a.b', 'c.d'] });

      expect(MockStoryblokBridge).toHaveBeenCalledWith(
        expect.objectContaining({ resolveRelations: ['a.b', 'c.d'] }),
      );
    });

    it('warns and removes the language option', () => {
      const warnSpy = vi.spyOn(console, 'warn');

      useStoryblokBridge(42, vi.fn(), { language: 'de' });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('language` bridge option is no longer supported'),
      );
      const passedOptions = MockStoryblokBridge.mock.calls[0][0];
      expect(passedOptions.language).toBeUndefined();
    });

    it('passes resolveLinks "link" through unchanged (valid per official docs)', () => {
      useStoryblokBridge(42, vi.fn(), { resolveLinks: 'link' });

      expect(MockStoryblokBridge).toHaveBeenCalledWith(
        expect.objectContaining({ resolveLinks: 'link' }),
      );
    });

    it('passes other resolveLinks values through unchanged', () => {
      useStoryblokBridge(42, vi.fn(), { resolveLinks: 'story' });

      expect(MockStoryblokBridge).toHaveBeenCalledWith(
        expect.objectContaining({ resolveLinks: 'story' }),
      );
    });
  });

  describe('editable', () => {
    it('gets data-blok-c and data-blok-uid', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(JSON.stringify({
          story: {
            id: 123456,
            uid: 'test-uid-123',
            content: { component: 'page', body: [] },
          },
        })));

      const { storyblokApi } = storyblokInit({
        accessToken: 'TEST_TOKEN',
        use: [apiPlugin],
      });

      const { data } = await storyblokApi!.get('cdn/stories/demo');
      const blok = data.story.content;
      blok._editable = `<!--#storyblok#{"id":${data.story.id},"uid":"${data.story.uid}"}-->`;

      const editableResult = storyblokEditable(blok);

      expect(editableResult['data-blok-c']).toBeDefined();
      expect(editableResult['data-blok-uid']).toBeDefined();
      expect(fetchSpy).toHaveBeenCalled();
    });
  });

  describe('rich text', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should call render with the provided data', () => {
      const data: SbRichTextDoc = { type: 'doc', content: [] };
      expect(renderRichText(data)).toBe('');
    });

    it('should use renderers for customize elements', () => {
      const data: SbRichTextDoc = { type: 'doc', content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] },
      ] };

      const html = renderRichText(data, {
        renderers: {
          paragraph: ({ content }) => `<div>${renderRichText(content)}</div>`,
        },
      });
      expect(html).toBe('<div>Hello</div>');
    });
  });

  describe('bridge functionality', () => {
    beforeEach(() => {
      // Reset module-level state in bridge.ts between tests by clearing the
      // window globals and re-importing fresh state via vi.resetModules().
      vi.resetModules();
      MockStoryblokBridge.mockClear();
      delete (window as any).storyblokRegisterEvent;
      delete (window as any).StoryblokBridge;
    });

    it('sets window.storyblokRegisterEvent synchronously and window.StoryblokBridge after load', async () => {
      const { loadBridge: fresh } = await import('./bridge');

      Object.defineProperty(window, 'location', {
        value: { search: '?_storyblok=123', href: 'http://localhost?_storyblok=123' },
        writable: true,
        configurable: true,
      });

      fresh();

      // storyblokRegisterEvent must be available synchronously
      expect(typeof (window as any).storyblokRegisterEvent).toBe('function');

      await flushPromises();

      // StoryblokBridge must be set after the dynamic import resolves
      expect((window as any).StoryblokBridge).toBe(MockStoryblokBridge);
    });

    it('queues callbacks registered before load and flushes them after', async () => {
      const { loadBridge: fresh } = await import('./bridge');

      Object.defineProperty(window, 'location', {
        value: { search: '?_storyblok=123', href: 'http://localhost?_storyblok=123' },
        writable: true,
        configurable: true,
      });

      fresh();

      const cb = vi.fn();
      (window as any).storyblokRegisterEvent(cb);

      expect(cb).not.toHaveBeenCalled();

      await flushPromises();

      expect(cb).toHaveBeenCalledOnce();
    });

    it('executes callbacks immediately when bridge is already loaded', async () => {
      const { loadBridge: fresh } = await import('./bridge');

      Object.defineProperty(window, 'location', {
        value: { search: '?_storyblok=123', href: 'http://localhost?_storyblok=123' },
        writable: true,
        configurable: true,
      });

      await fresh();
      await flushPromises();

      const cb = vi.fn();
      (window as any).storyblokRegisterEvent(cb);

      expect(cb).toHaveBeenCalledOnce();
    });

    it('executes callbacks in registration order', async () => {
      const { loadBridge: fresh } = await import('./bridge');

      Object.defineProperty(window, 'location', {
        value: { search: '?_storyblok=123', href: 'http://localhost?_storyblok=123' },
        writable: true,
        configurable: true,
      });

      fresh();

      const order: number[] = [];
      (window as any).storyblokRegisterEvent(() => order.push(1));
      (window as any).storyblokRegisterEvent(() => order.push(2));
      (window as any).storyblokRegisterEvent(() => order.push(3));

      await flushPromises();

      expect(order).toEqual([1, 2, 3]);
    });

    it('warns and does not queue when not in draft mode', async () => {
      const { loadBridge: fresh } = await import('./bridge');

      Object.defineProperty(window, 'location', {
        value: { search: '?foo=bar', href: 'http://localhost?foo=bar' },
        writable: true,
        configurable: true,
      });

      fresh();

      const warnSpy = vi.spyOn(console, 'warn');
      const cb = vi.fn();
      (window as any).storyblokRegisterEvent(cb);

      expect(warnSpy).toHaveBeenCalledWith('You are not in Draft Mode or in the Visual Editor.');
      expect(cb).not.toHaveBeenCalled();
    });

    it('rejects when window is undefined (SSR)', async () => {
      const originalWindow = (globalThis as any).window;
      delete (globalThis as any).window;

      const { loadBridge: fresh } = await import('./bridge');

      await expect(fresh()).rejects.toThrow(
        'Cannot load Storyblok bridge: window is undefined (server-side environment)',
      );

      (globalThis as any).window = originalWindow;
    });

    it('returns the same promise on concurrent calls', async () => {
      const { loadBridge: fresh } = await import('./bridge');

      Object.defineProperty(window, 'location', {
        value: { search: '?_storyblok=1', href: 'http://localhost?_storyblok=1' },
        writable: true,
        configurable: true,
      });

      const p1 = fresh();
      const p2 = fresh();

      expect(p1).toBe(p2);
    });
  });

  // Keep a thin smoke-test for the re-exported loadBridge to ensure
  // the module-level singleton resets work in test isolation.
  describe('loadBridge (direct import)', () => {
    beforeEach(() => {
      vi.resetModules();
      MockStoryblokBridge.mockClear();
      delete (window as any).storyblokRegisterEvent;
      delete (window as any).StoryblokBridge;
    });

    it('resolves and sets window.StoryblokBridge', async () => {
      Object.defineProperty(window, 'location', {
        value: { search: '?_storyblok=1', href: 'http://localhost?_storyblok=1' },
        writable: true,
        configurable: true,
      });

      await loadBridge();
      await flushPromises();

      expect((window as any).StoryblokBridge).toBeDefined();
    });
  });
});
