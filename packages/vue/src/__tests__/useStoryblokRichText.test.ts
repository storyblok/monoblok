import { describe, expect, it } from 'vitest';
import { h } from 'vue';
import { useStoryblokRichText } from '../composables/useStoryblokRichText';
import type { StoryblokRichTextNode } from '@storyblok/js';
import { BlockTypes } from '@storyblok/js';

describe('useStoryblokRichText', () => {
  it('should render rich text without crashing', () => {
    const { render } = useStoryblokRichText();

    const doc: StoryblokRichTextNode = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Hello world',
            },
          ],
        },
      ],
    };

    const result = render(doc);
    expect(result).toBeDefined();
  });

  it('should handle ordered lists with embedded components without resolveComponent errors', () => {
    const { render } = useStoryblokRichText();

    const doc: StoryblokRichTextNode = {
      type: 'doc',
      content: [
        {
          type: 'ordered_list',
          content: [
            {
              type: 'list_item',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: 'List item with component: ',
                    },
                  ],
                },
                {
                  type: 'blok',
                  attrs: {
                    id: 'test-component',
                    body: [
                      {
                        _uid: '12345',
                        component: 'TestComponent',
                        title: 'Test Title',
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    // This should not throw a "resolveComponent can only be used in render()" error
    expect(() => {
      const result = render(doc);
      expect(result).toBeDefined();
    }).not.toThrow();
  });

  it('should handle empty component gracefully', () => {
    const { render } = useStoryblokRichText();

    const doc: StoryblokRichTextNode = {
      type: 'doc',
      content: [
        {
          type: 'blok',
          attrs: {
            body: [],
          },
        },
      ],
    };

    const result = render(doc);
    expect(result).toBeDefined();
  });

  it('should merge custom resolvers properly', () => {
    const customResolver = () => h('div', { class: 'custom-paragraph' }, 'Custom content');

    const { render } = useStoryblokRichText({
      resolvers: {
        [BlockTypes.PARAGRAPH]: customResolver,
      },
    });

    const doc: StoryblokRichTextNode = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'This should use custom resolver',
            },
          ],
        },
      ],
    };

    const result = render(doc);
    expect(result).toBeDefined();
  });
});
