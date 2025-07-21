import { describe, expect, it } from 'vitest';
import { markdownToStoryblokRichtext } from './markdown-parser';

describe('markdownToStoryblokRichtext', () => {
  it('parses headings', () => {
    const md = '# Heading 1\n## Heading 2';
    const result = markdownToStoryblokRichtext(md);
    expect(result).toMatchObject({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Heading 1' }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Heading 2' }],
        },
      ],
    });
  });

  it('parses paragraphs', () => {
    const md = 'This is a paragraph.';
    const result = markdownToStoryblokRichtext(md);
    expect(result).toMatchObject({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'This is a paragraph.' }],
        },
      ],
    });
  });

  it('parses bold and italic marks', () => {
    const md = '**bold** and *italic*';
    const result = markdownToStoryblokRichtext(md);
    expect(result).toMatchObject({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' and ' },
            { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
          ],
        },
      ],
    });
  });

  it('parses unordered (bullet) lists', () => {
    const md = '- Item 1\n- Item 2';
    const result = markdownToStoryblokRichtext(md);
    expect(result).toMatchObject({
      type: 'doc',
      content: [
        {
          type: 'bullet_list',
          content: [
            {
              type: 'list_item',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Item 1' }],
                },
              ],
            },
            {
              type: 'list_item',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Item 2' }],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it('parses ordered lists', () => {
    const md = '1. First\n2. Second';
    const result = markdownToStoryblokRichtext(md);
    expect(result).toMatchObject({
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
                  content: [{ type: 'text', text: 'First' }],
                },
              ],
            },
            {
              type: 'list_item',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Second' }],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it('uses a custom heading resolver', () => {
    const md = '# Custom Heading';
    const result = markdownToStoryblokRichtext(md, {
      resolvers: {
        heading: (node, children) => ({
          type: 'heading',
          attrs: { level: 99, custom: true }, // Custom level and attribute
          content: children,
        }),
      },
    });
    expect(result).toMatchObject({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 99, custom: true },
          content: [{ type: 'text', text: 'Custom Heading' }],
        },
      ],
    });
  });

  it('uses a custom paragraph resolver', () => {
    const md = 'Paragraph with custom attr.';
    const result = markdownToStoryblokRichtext(md, {
      resolvers: {
        paragraph: (node, children) => ({
          type: 'paragraph',
          attrs: { custom: 'yes' },
          content: children,
        }),
      },
    });
    expect(result).toMatchObject({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { custom: 'yes' },
          content: [{ type: 'text', text: 'Paragraph with custom attr.' }],
        },
      ],
    });
  });

  // Add more tests as new features are supported
});

// Inline comments explain the purpose of each test and expected output structure.
