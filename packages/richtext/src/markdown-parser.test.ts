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

  it('parses images', () => {
    const md = '![Alt text for image](https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg "Image Title")';
    const result = markdownToStoryblokRichtext(md);
    expect(result).toMatchObject({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'image',
              attrs: {
                src: 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg',
                alt: 'Alt text for image',
                title: 'Image Title',
              },
            },
          ],
        },
      ],
    });
  });

  it('parses tables', () => {
    const md = `| Header 1 | Header 2 | Header 3 |\n|----------|----------|----------|\n| R1C1     | R1C2     | R1C3     |\n| R2C1     | R2C2     | R2C3     |\n| R3C1     | R3C2     | R3C3     |`;
    const result = markdownToStoryblokRichtext(md);
    expect(result).toMatchObject({
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [
                    { type: 'text', text: 'Header 1' },
                  ],
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                },
                {
                  type: 'tableCell',
                  content: [
                    { type: 'text', text: 'Header 2' },
                  ],
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                },
                {
                  type: 'tableCell',
                  content: [
                    { type: 'text', text: 'Header 3' },
                  ],
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                },
              ],
            },
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [
                    { type: 'text', text: 'R1C1' },
                  ],
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                },
                {
                  type: 'tableCell',
                  content: [
                    { type: 'text', text: 'R1C2' },
                  ],
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                },
                {
                  type: 'tableCell',
                  content: [
                    { type: 'text', text: 'R1C3' },
                  ],
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                },
              ],
            },
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [
                    { type: 'text', text: 'R2C1' },
                  ],
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                },
                {
                  type: 'tableCell',
                  content: [
                    { type: 'text', text: 'R2C2' },
                  ],
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                },
                {
                  type: 'tableCell',
                  content: [
                    { type: 'text', text: 'R2C3' },
                  ],
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                },
              ],
            },
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [
                    { type: 'text', text: 'R3C1' },
                  ],
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                },
                {
                  type: 'tableCell',
                  content: [
                    { type: 'text', text: 'R3C2' },
                  ],
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                },
                {
                  type: 'tableCell',
                  content: [
                    { type: 'text', text: 'R3C3' },
                  ],
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it('parses blockquotes', () => {
    const md = '> This is a blockquote.';
    const result = markdownToStoryblokRichtext(md);
    expect(result).toMatchObject({
      type: 'doc',
      content: [
        {
          type: 'blockquote',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'This is a blockquote.' },
              ],
            },
          ],
        },
      ],
    });
  });

  it('parses blockquotes with nested formatting', () => {
    const md = '> A blockquote with **bold** text.';
    const result = markdownToStoryblokRichtext(md);
    expect(result).toMatchObject({
      type: 'doc',
      content: [
        {
          type: 'blockquote',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'A blockquote with ' },
                { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
                { type: 'text', text: ' text.' },
              ],
            },
          ],
        },
      ],
    });
  });

  it('parses inline code', () => {
    const md = 'This is `inline code`.';
    const result = markdownToStoryblokRichtext(md);
    expect(result).toMatchObject({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'This is ' },
            { type: 'text', text: 'inline code', marks: [{ type: 'code' }] },
            { type: 'text', text: '.' },
          ],
        },
      ],
    });
  });

  it('parses code blocks', () => {
    const md = '```js\nconst foo = "bar";\nconsole.log(foo);\n```';
    const result = markdownToStoryblokRichtext(md);
    expect(result).toMatchObject({
      type: 'doc',
      content: [
        {
          type: 'code_block',
          attrs: { language: 'js' },
          content: [
            { type: 'text', text: 'const foo = "bar";\nconsole.log(foo);' },
          ],
        },
      ],
    });
  });

  it('parses links', () => {
    const md = 'This is a [Storyblok link](https://www.storyblok.com/).';
    const result = markdownToStoryblokRichtext(md);
    expect(result).toMatchObject({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'This is a ' },
            {
              type: 'link',
              attrs: {
                href: 'https://www.storyblok.com/',
                title: null,
              },
              content: [
                { type: 'text', text: 'Storyblok link' },
              ],
            },
            { type: 'text', text: '.' },
          ],
        },
      ],
    });
  });

  it('parses horizontal rules (thematic breaks)', () => {
    const md = 'Paragraph above.\n\n---\n\nParagraph below.';
    const result = markdownToStoryblokRichtext(md);
    expect(result).toMatchObject({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Paragraph above.' },
          ],
        },
        {
          type: 'horizontal_rule',
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Paragraph below.' },
          ],
        },
      ],
    });
  });

  it('parses strikethrough (delete) marks', () => {
    const md = 'This is ~~deleted text~~.';
    const result = markdownToStoryblokRichtext(md);
    expect(result).toMatchObject({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'This is ' },
            { type: 'text', text: 'deleted text', marks: [{ type: 'strike' }] },
            { type: 'text', text: '.' },
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
