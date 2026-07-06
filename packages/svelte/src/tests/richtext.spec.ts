import { describe, expect, it } from 'vitest';
import { customRendererFixture, integrationFixtures, linkFixtures, markFixtures, nodeFixtures, tableFixtures } from '@storyblok/richtext/test-utils';
import StoryblokRichText from '../lib/StoryblokRichText.svelte';
import { flushSync, mount, unmount } from 'svelte';
import CustomTable from './richtext/CustomTable.svelte';
import Bold from './richtext/Bold.svelte';
import CustomCode from './richtext/CustomCode.svelte';
import Heading from './richtext/Heading.svelte';
import CustomLink from './richtext/CustomLink.svelte';
import CustomText from './richtext/CustomText.svelte';
import HeadingWithRichText from './richtext/HeadingWithRichText.svelte';

// Helper function to clean up the HTML output for easier comparison
export function cleanHtml(html: string) {
  return html
    .replace(/<!--[^>]*-->/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
describe('storyblok Richtext', () => {
  describe('input handling', async () => {
    it('returns empty string for null input', async () => {
      const target = document.createElement('div');
      const component = mount(StoryblokRichText, {
        target, // `document` exists because of jsdom
        props: { document: null },
      });
      flushSync();
      const result = cleanHtml(target.innerHTML);
      expect(result).toBe('');
      unmount(component);
    });
    it('returns empty string for undefined input', async () => {
      const target = document.createElement('div');
      const component = mount(StoryblokRichText, {
        target, // `document` exists because of jsdom
        props: { document: undefined },
      });
      flushSync();
      const result = cleanHtml(target.innerHTML);
      expect(result).toBe('');
      unmount(component);
    });
    it('returns empty string for empty array', async () => {
      const target = document.createElement('div');
      const component = mount(StoryblokRichText, {
        target, // `document` exists because of jsdom
        props: { document: [] },
      });
      flushSync();
      const result = cleanHtml(target.innerHTML);
      expect(result).toBe('');
      unmount(component);
    });
  });
  describe('nodes', () => {
    nodeFixtures.forEach(({ title, input, expected }) => {
      it(title, () => {
        const target = document.createElement('div');
        const component = mount(StoryblokRichText, {
          target, // `document` exists because of jsdom
          props: { document: input },
        });
        flushSync();
        const result = cleanHtml(target.innerHTML);
        expect(result).toBe(expected);
        unmount(component);
      });
    });
  });
  describe('tables', () => {
    tableFixtures.forEach(({ title, input, expected }) => {
      it(title, () => {
        const target = document.createElement('div');
        const component = mount(StoryblokRichText, {
          target, // `document` exists because of jsdom
          props: { document: input },
        });
        flushSync();
        const result = cleanHtml(target.innerHTML);
        expect(result).toBe(expected);
        unmount(component);
      });
    });
  });
  describe('marks', () => {
    markFixtures.forEach(({ title, input, expected }) => {
      it(title, () => {
        const target = document.createElement('div');
        const component = mount(StoryblokRichText, {
          target, // `document` exists because of jsdom
          props: { document: input },
        });
        flushSync();
        const result = cleanHtml(target.innerHTML);
        expect(result).toBe(expected);
        unmount(component);
      });
    });
  });
  describe('links', () => {
    linkFixtures.forEach(({ title, input, expected }) => {
      it(title, () => {
        const target = document.createElement('div');
        const component = mount(StoryblokRichText, {
          target, // `document` exists because of jsdom
          props: { document: input },
        });
        flushSync();
        const result = cleanHtml(target.innerHTML);
        expect(result).toBe(expected);
        unmount(component);
      });
    });
  });
  describe('integration', () => {
    integrationFixtures.forEach(({ title, input, expected }) => {
      it(title, () => {
        const target = document.createElement('div');
        const component = mount(StoryblokRichText, {
          target, // `document` exists because of jsdom
          props: { document: input },
        });
        flushSync();
        const result = cleanHtml(target.innerHTML);
        expect(result).toBe(expected);
        unmount(component);
      });
    });
  });
  describe('custom renderers', () => {
    const node_and_mark = customRendererFixture.node_and_mark;
    it(node_and_mark.title, () => {
      const target = document.createElement('div');
      const component = mount(StoryblokRichText, {
        target, // `document` exists because of jsdom
        props: { document: node_and_mark.input, components: { heading: Heading, bold: Bold, link: CustomLink } },
      });
      flushSync();
      const result = cleanHtml(target.innerHTML);
      expect(result).toBe(node_and_mark.expected);
      unmount(component);
    });
    const recursive = customRendererFixture.recursive;
    it(recursive.title, () => {
      const target = document.createElement('div');
      const component = mount(StoryblokRichText, {
        target, // `document` exists because of jsdom
        props: { document: recursive.input, components: { heading: Heading, bold: Bold } },
      });
      flushSync();
      const result = cleanHtml(target.innerHTML);
      expect(result).toBe(recursive.expected);
      unmount(component);
    });
    const code_block = customRendererFixture.code_block;
    it(code_block.title, () => {
      const target = document.createElement('div');
      const component = mount(StoryblokRichText, {
        target, // `document` exists because of jsdom
        props: { document: code_block.input, components: { code_block: CustomCode } },
      });
      flushSync();
      const result = cleanHtml(target.innerHTML);
      expect(result).toBe(code_block.expected);
      unmount(component);
    });
    const table = customRendererFixture.table;
    it(table.title, () => {
      const target = document.createElement('div');
      const component = mount(StoryblokRichText, {
        target, // `document` exists because of jsdom
        props: { document: table.input, components: { table: CustomTable, bold: Bold } },
      });
      flushSync();
      const result = cleanHtml(target.innerHTML);
      expect(result).toBe(table.expected);
      unmount(component);
    });
    const text_node = customRendererFixture.text_node;
    it(text_node.title, () => {
      const target = document.createElement('div');
      const component = mount(StoryblokRichText, {
        target,
        props: {
          document: text_node.input,
          data: { prefix: '[prefix]' },
          components: { text: CustomText },
        },
      });
      flushSync();
      const result = cleanHtml(target.innerHTML);
      expect(result).toBe(text_node.expected);
      unmount(component);
    });
    const infinite_loop = customRendererFixture.infinite_loop_prevention;
    it(infinite_loop.title, () => {
      const target = document.createElement('div');
      const component = mount(StoryblokRichText, {
        target,
        props: {
          document: infinite_loop.input,
          components: { heading: HeadingWithRichText },
        },
      });
      flushSync();
      const result = cleanHtml(target.innerHTML);
      expect(result).toBe(infinite_loop.expected);
      unmount(component);
    });
  });
});
