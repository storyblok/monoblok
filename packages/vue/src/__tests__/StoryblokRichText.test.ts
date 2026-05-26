import { describe, expect, it } from 'vitest';
import StoryblokRichText from '../components/StoryblokRichText.vue';
import { mount } from '@vue/test-utils';
import { integrationFixtures, linkFixtures, markFixtures, nodeFixtures, tableFixtures } from '@storyblok/richtext/test-utils';

describe('storyblok vue richtext rendering', () => {
  describe('input handling', () => {
    it('returns empty string for null input', () => {
      const wrapper = mount(StoryblokRichText, {
        props: {
          document: null,
        },
      });
      expect(wrapper.html({ raw: true })).toBe('');
    });
    it('returns empty string for undefined input', () => {
      const wrapper = mount(StoryblokRichText, {
        props: {
          document: undefined,
        },
      });
      expect(wrapper.html({ raw: true })).toBe('');
    });
    it('returns empty string for empty array', () => {
      const wrapper = mount(StoryblokRichText, {
        props: {
          document: [],
        },
      });
      expect(wrapper.html({ raw: true })).toBe('');
    });
  });
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
  // describe('custom components', () => {
  // const node_and_mark = customRendererFixture.node_and_mark;
  // it(node_and_mark.title, () => {
  //   const components: SbVueRichTextComponentMap = {
  //     heading: ({ attrs }, children) => h('h2', { 'data-type': 'custom-heading', 'data-level': attrs?.level }, () => children),
  //     bold: (_, children) => h('b', { 'data-type': 'custom-bold' }, () => children),
  //   };
  //   const wrapper = mount(StoryblokRichText, {
  //     props: {
  //       document: node_and_mark.input,
  //       components,
  //     },
  //   });
  //   expect((wrapper.html({ raw: true }))).toBe(node_and_mark.expected);
  // });
  // const recursive = customRendererFixture.recursive;
  // it(recursive.title, () => {
  //   const components: SbVueRichTextComponentMap = {
  //     heading: ({ content, attrs }) => h('h1', { 'data-type': 'custom-heading', 'data-level': attrs?.level }, [h(StoryblokRichText, { wrapper: false, document: content, components })]),
  //     bold: ({ children }) => h('b', { 'data-type': 'custom-bold' }, children),
  //   };
  //   const wrapper = mount(StoryblokRichText, {
  //     props: {
  //       document: recursive.input,
  //       components,
  //     },
  //   });

  //   expect((wrapper.html({ raw: true }))).toBe(recursive.expected);
  // });
  // const code_block = customRendererFixture.code_block;
  // it(code_block.title, () => {
  //   const components: SbVueRichTextComponentMap = {
  //     code_block: CustomCodeBlock,
  //   };
  //   const wrapper = mount(StoryblokRichText, {
  //     props: {
  //       document: code_block.input,
  //       components,
  //     },
  //   });
  //   expect((wrapper.html({ raw: true }))).toBe(code_block.expected);
  // });
  // const table = customRendererFixture.table;

  // it(table.title, () => {
  //   const components: SbVueRichTextComponentMap = {
  //     table: CustomTable,
  //     bold: ({ children }) => h('b', { 'data-type': 'custom-bold' }, children),
  //   };
  //   const wrapper = mount(StoryblokRichText, {
  //     props: {
  //       document: table.input,
  //       components,
  //     },
  //   });
  //   expect((wrapper.html({ raw: true }))).toBe(table.expected);
  // });
  // });
});
