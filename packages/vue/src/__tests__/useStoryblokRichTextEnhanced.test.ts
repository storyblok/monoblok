import { describe, expect, it } from 'vitest';
import { h } from 'vue';
import { useStoryblokRichTextEnhanced } from '../composables/useStoryblokRichTextEnhanced';
import type { StoryblokRichTextNode } from '@storyblok/js';
import { BlockTypes } from '@storyblok/js';

describe('useStoryblokRichTextEnhanced', () => {
  it('should render rich text without crashing', () => {
    const { render } = useStoryblokRichTextEnhanced();

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
    const { render } = useStoryblokRichTextEnhanced();

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
    const { render } = useStoryblokRichTextEnhanced();

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

    const { render } = useStoryblokRichTextEnhanced({
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
