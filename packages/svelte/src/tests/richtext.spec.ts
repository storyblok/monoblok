import { describe, expect, it } from 'vitest';
import { integrationFixtures, linkFixtures, markFixtures, nodeFixtures, tableFixtures } from '@storyblok/richtext/test-utils';
import StoryblokRichText from '../lib/StoryblokRichText.svelte';
import { flushSync, mount, unmount } from 'svelte';

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
});
