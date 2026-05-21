import { describe, expect, it } from 'vitest';
import { integrationFixtures, linkFixtures, linkMark, markFixtures, nodeFixtures, tableFixtures, text } from '@storyblok/richtext/test-utils';
import StoryblokRichText from '../lib/StoryblokRichText.svelte';
import { flushSync, mount, unmount } from 'svelte';
import type { SbRichTextDoc } from '../lib/index';
import Heading from './richtext/Heading.svelte';
import Bold from './richtext/Bold.svelte';
import CustomLink from './richtext/CustomLink.svelte';

function cleanHtml(html: string) {
  return html
    .replace(/<!--[^>]*-->/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
describe('storyblokRichText.svelte', () => {
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
  describe('custom components', () => {
    it('renders custom components', () => {
      const target = document.createElement('div');
      const doc: SbRichTextDoc = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2, textAlign: 'center' },
            content: [{ type: 'text', text: 'Hello World', marks: [{ type: 'bold' }] }],
          },
          text('This is an internal story', [linkMark('/page', { linktype: 'story', anchor: 'intro' })]),
        ],
      };
      const component = mount(StoryblokRichText, {
        target,
        props: {
          document: doc,
          components: { heading: Heading, bold: Bold, link: CustomLink },
        },
      });
      flushSync();
      const result = cleanHtml(target.innerHTML);
      expect(result).toBe(`<p data-type="custom-heading" data-level="2"><b data-type="custom-bold">Hello World</b></p><a data-type="custom-link" href="/page#intro" target="_self">This is an internal story</a>`);
      unmount(component);
    });
  });
});
