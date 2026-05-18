import { describe, expect, it } from 'vitest';
import StoryblokRichText from '../components/StoryblokRichText.vue';
import { mount } from '@vue/test-utils';
import { integrationFixtures, linkFixtures, markFixtures, nodeFixtures, tableFixtures } from '@storyblok/richtext/test-utils';

describe('storyblok vue richtext rendering', () => {
  describe('nodes', () => {
    nodeFixtures.forEach(({ title, input, expected }) => {
      it(title, () => {
        const wrapper = mount(StoryblokRichText, {
          props: {
            document: input,
          },
        });
        expect(wrapper.html({ raw: true })).toBe(expected);
      });
    });
  });
  describe('marks', () => {
    markFixtures.forEach(({ title, input, expected }) => {
      it(title, () => {
        const wrapper = mount(StoryblokRichText, {
          props: {
            document: input,
          },
        });
        expect(wrapper.html({ raw: true })).toBe(expected);
      });
    });
  });
  describe('links', () => {
    linkFixtures.forEach(({ title, input, expected }) => {
      it(title, () => {
        const wrapper = mount(StoryblokRichText, {
          props: {
            document: input,
          },
        });
        expect(wrapper.html({ raw: true })).toBe(expected);
      });
    });
  });
  describe('tables', () => {
    tableFixtures.forEach(({ title, input, expected }) => {
      it(title, () => {
        const wrapper = mount(StoryblokRichText, {
          props: {
            document: input,
          },
        });
        expect(wrapper.html({ raw: true })).toBe(expected);
      });
    });
  });
  describe('integration', () => {
    integrationFixtures.forEach(({ title, input, expected }) => {
      it(title, () => {
        const wrapper = mount(StoryblokRichText, {
          props: {
            document: input,
          },
        });
        expect(wrapper.html({ raw: true })).toBe(expected);
      });
    });
  });
});
