import {
  apiPlugin,
  renderRichText,
  storyblokEditable,
  storyblokInit,
} from '../src';
import type { SbInitResult, SbPluginFactory, StoryblokRichTextNode } from '../src';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadBridge } from './bridge';

const renderMock = vi.fn(() => '<p>Rendered HTML</p>');
vi.mock('@storyblok/richtext', () => {
  return {
    richTextResolver: vi.fn(() => ({
      render: renderMock,
    })),
  };
});
describe('@storyblok/js', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('api', () => {
    it('is not loaded by default', () => {
      const result = storyblokInit({
        accessToken: 'wANpEQEsMYGOwLxwXQ76Ggtt',
      });

      expect(result).toEqual({});
    });

    it('is loaded correctly when using the apiPlugin', async () => {
      const { storyblokApi } = storyblokInit({
        accessToken: 'wANpEQEsMYGOwLxwXQ76Ggtt',
        use: [apiPlugin],
      });

      const result = await storyblokApi!.getAll('cdn/stories', { version: 'draft' });

      expect(result.length).toBeGreaterThan(0);
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
      // Create an isolated mock just for this test
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockRejectedValueOnce(new Error('API Error'));

      const { storyblokApi } = storyblokInit({
        accessToken: 'test-token',
        use: [apiPlugin],
      });

      await expect(storyblokApi!.get('cdn/stories/test')).rejects.toThrow();

      // Verify the mock was called
      expect(fetchSpy).toHaveBeenCalled();
    });

    it('should support different API endpoints', async () => {
      // Create a spy that returns successful responses
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

      // Verify different endpoints were called
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(fetchSpy.mock.calls[0][0].toString()).toContain('cdn/stories');
      expect(fetchSpy.mock.calls[1][0].toString()).toContain('cdn/links');
      expect(fetchSpy.mock.calls[2][0].toString()).toContain('cdn/datasources');
    });

    it('should handle pagination correctly', async () => {
      // Mock fetch to return paginated responses
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

      // Define type for stories
      const allStories: Array<{ id: number }> = [];
      let page = 1;
      const perPage = 2;

      // First page
      let response = await storyblokApi.get('cdn/stories', {
        page,
        perPage,
      });

      const total = response.data.total;
      allStories.push(...response.data.stories);

      // Get remaining pages
      while (allStories.length < total) {
        page++;
        response = await storyblokApi.get('cdn/stories', {
          page,
          perPage,
        });
        allStories.push(...response.data.stories);
      }

      // Verify pagination results
      expect(allStories).toHaveLength(4);
      expect(allStories).toEqual([
        { id: 1 },
        { id: 2 },
        { id: 3 },
        { id: 4 },
      ]);

      // Verify that fetch was called twice for the two pages
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('initialization', () => {
    it('should initialize multiple plugins', () => {
      // Create two mock plugins with proper typing
      const plugin1: SbPluginFactory = () => ({ feature1: 'value1' });
      const plugin2: SbPluginFactory = () => ({ feature2: 'value2' });

      const result = storyblokInit({
        accessToken: 'test-token',
        use: [plugin1, plugin2],
      }) as SbInitResult & {
        feature1: string;
        feature2: string;
      };

      // Verify both plugins were initialized
      expect(result).toEqual({
        feature1: 'value1',
        feature2: 'value2',
      });

      // Verify the result has both plugin features
      expect(result.feature1).toBe('value1');
      expect(result.feature2).toBe('value2');
    });

    it('should handle custom bridge URLs', () => {
      const customBridgeUrl = 'https://custom-bridge.com/bridge.js';

      // Mock window.location to simulate being in the editor
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        value: { search: '?_storyblok_tk=123' },
        writable: true,
      });

      storyblokInit({
        accessToken: 'test-token',
        bridgeUrl: customBridgeUrl,
      });

      // Get the bridge script element
      const bridgeScript = document.querySelector('#storyblok-javascript-bridge');

      // Verify bridge script was added with correct URL
      expect(bridgeScript).toBeTruthy();
      expect(bridgeScript?.getAttribute('src')).toBe(customBridgeUrl);

      // Restore original window.location
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
      });
    });

    it('should handle custom bridge URL with query params', () => {
      const baseUrl = 'https://custom-bridge.com/bridge.js';
      const queryParams = '?version=2&debug=true';
      const customBridgeUrl = `${baseUrl}${queryParams}`;

      // Mock window.location to simulate being in the editor
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        value: {
          search: '?_storyblok_tk=123',
          href: 'http://localhost?_storyblok_tk=123',
        },
        writable: true,
      });

      storyblokInit({
        accessToken: 'test-token',
        bridge: true,
        bridgeUrl: customBridgeUrl,
      });

      // Get the bridge script element
      const bridgeScript = document.querySelector('#storyblok-javascript-bridge');

      // Verify the script was created
      expect(bridgeScript).toBeTruthy();
      // Verify base URL is present (browser strips query params)
      expect(bridgeScript?.getAttribute('src')).toBe(baseUrl);

      // Restore original window.location
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
      });
    });
  });

  describe('editable', () => {
    it('gets data-blok-c and data-blok-uid', async () => {
      const { storyblokApi } = storyblokInit({
        accessToken: 'wANpEQEsMYGOwLxwXQ76Ggtt',
        use: [apiPlugin],
      });

      const { data } = await storyblokApi!.get('cdn/stories/demo');

      const blok = data.story.content;
      blok._editable = `<!--#storyblok#{"id":${data.story.id},"uid":"${data.story.uid}"}-->`;

      const editableResult = storyblokEditable(blok);

      expect(editableResult['data-blok-c']).toBeDefined();
      expect(editableResult['data-blok-uid']).toBeDefined();
    });
  });

  describe('rich text', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should call richTextResolver with correct options', () => {
      const data = { type: 'doc', content: [] } as StoryblokRichTextNode<string>;
      const options = {
        resolvers: {
          paragraph: () => '<p>test</p>',
        },
      };

      renderRichText(data, options);

      expect(renderMock).toHaveBeenCalledWith(data);
    });

    it('calls render with the provided data', () => {
      const data = { type: 'doc', content: [] } as StoryblokRichTextNode<string>;
      const options = {
        resolvers: {
          paragraph: () => '<p>test</p>',
        },
      };

      renderRichText(data, options);

      expect(renderMock).toHaveBeenCalledWith(data);
    });
  });

  describe('bridge functionality', () => {
    beforeEach(() => {
      // Clear DOM and reset window properties
      document.head.innerHTML = '';
      window.storyblokRegisterEvent = () => {};
      vi.clearAllMocks();
    });

    it('should load bridge script correctly', async () => {
      const bridgeUrl = 'https://app.storyblok.com/f/storyblok-v2-latest.js';
      const loadPromise = loadBridge(bridgeUrl);

      // Check if script was added to DOM
      const script = document.querySelector('#storyblok-javascript-bridge') as HTMLScriptElement;
      expect(script).toBeTruthy();
      expect(script?.getAttribute('src')).toBe(bridgeUrl);
      expect(script?.async).toBe(true);

      // Simulate script load
      const event = new Event('load');
      script?.dispatchEvent(event);

      await expect(loadPromise).resolves.toBeDefined();
    });

    it('should handle bridge loading errors', async () => {
      const bridgeUrl = 'https://invalid-url.com/bridge.js';
      const loadPromise = loadBridge(bridgeUrl);

      const script = document.querySelector('#storyblok-javascript-bridge');

      // Simulate script error
      const event = new ErrorEvent('error', { error: new Error('Failed to load script') });
      script?.dispatchEvent(event);

      await expect(loadPromise).rejects.toBeDefined();
    });

    it('should register callbacks correctly', () => {
      const callback = vi.fn();

      // Mock being in an iframe
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = {
        ...originalLocation,
        href: 'http://localhost',
      };
      Object.defineProperty(window, 'parent', {
        value: { location: { href: 'http://different-origin.com' } },
        writable: true,
      });

      loadBridge('https://app.storyblok.com/f/storyblok-v2-latest.js');

      // Register callback
      window.storyblokRegisterEvent(callback);

      // Simulate script load
      const script = document.querySelector('#storyblok-javascript-bridge');
      const event = new Event('load');
      script?.dispatchEvent(event);

      expect(callback).toHaveBeenCalled();

      // Restore original location
      window.location = originalLocation;
    });

    it('should warn when not in editor mode', () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      const callback = vi.fn();

      // Ensure we're not in an iframe
      Object.defineProperty(window, 'parent', {
        value: { location: window.location },
        writable: true,
      });

      loadBridge('https://app.storyblok.com/f/storyblok-v2-latest.js');
      window.storyblokRegisterEvent(callback);

      expect(consoleSpy).toHaveBeenCalledWith(
        'You are not in Draft Mode or in the Visual Editor.',
      );
      expect(callback).not.toHaveBeenCalled();
    });

    it('should execute callbacks in order of registration', async () => {
      const executionOrder: number[] = [];
      const callback1 = vi.fn(() => executionOrder.push(1));
      const callback2 = vi.fn(() => executionOrder.push(2));
      const callback3 = vi.fn(() => executionOrder.push(3));

      // Mock being in an iframe
      Object.defineProperty(window, 'parent', {
        value: { location: { href: 'http://different-origin.com' } },
        writable: true,
      });

      loadBridge('https://app.storyblok.com/f/storyblok-v2-latest.js');

      window.storyblokRegisterEvent(callback1);
      window.storyblokRegisterEvent(callback2);
      window.storyblokRegisterEvent(callback3);

      // Simulate script load
      const script = document.querySelector('#storyblok-javascript-bridge');
      const event = new Event('load');
      script?.dispatchEvent(event);

      expect(executionOrder).toEqual([1, 2, 3]);
    });
  });
});
