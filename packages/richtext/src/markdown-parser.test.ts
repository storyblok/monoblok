import { describe, expect, it } from 'vitest';
import { markdownToStoryblokRichtext } from './markdown-parser';

describe('markdownToStoryblokRichtext', () => {
  it('parses tables', () => {
    const md = `| Header 1 | Header 2 | Header 3 |\n|----------|----------|----------|\n| R1C1     | R1C2     | R1C3     |\n| **R2C1** | *R2C2*   | R2C3     |\n| R3C1     | R3C2     | R3C3     |`;
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
                  type: 'tableHeader',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Header 1' }],
                    },
                  ],
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                },
                {
                  type: 'tableHeader',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Header 2' }],
                    },
                  ],
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                },
                {
                  type: 'tableHeader',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Header 3' }],
                    },
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
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'R1C1' }],
                    },
                  ],
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                },
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'R1C2' }],
                    },
                  ],
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                },
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'R1C3' }],
                    },
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
                    {
                      type: 'paragraph',
                      content: [
                        {
                          type: 'text',
                          text: 'R2C1',
                          marks: [{ type: 'bold' }],
                        },
                      ],
                    },
                  ],
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                },
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [
                        {
                          type: 'text',
                          text: 'R2C2',
                          marks: [{ type: 'italic' }],
                        },
                      ],
                    },
                  ],
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                },
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'R2C3' }],
                    },
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
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'R3C1' }],
                    },
                  ],
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                },
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'R3C2' }],
                    },
                  ],
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                },
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'R3C3' }],
                    },
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
              type: 'text',
              text: 'Storyblok link',
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: 'https://www.storyblok.com/',
                  },
                },
              ],
            },
            { type: 'text', text: '.' },
          ],
        },
      ],
    });
  });

  it('parses formatting inside links', () => {
    const md = 'This is a [Storyblok _link_](https://www.storyblok.com/).';
    const result = markdownToStoryblokRichtext(md);
    expect(result).toMatchObject({
      type: 'doc',
      content: [
        {
          content: [
            {
              text: 'This is a ',
              type: 'text',
            },
            {
              marks: [
                {
                  attrs: {
                    href: 'https://www.storyblok.com/',
                    uuid: null,
                    anchor: null,
                    target: null,
                    linktype: 'url',
                  },
                  type: 'link',
                },
              ],
              text: 'Storyblok ',
              type: 'text',
            },
            {
              marks: [
                {
                  attrs: {
                    href: 'https://www.storyblok.com/',
                    uuid: null,
                    anchor: null,
                    target: null,
                    linktype: 'url',
                  },
                  type: 'link',
                },
                {
                  type: 'italic',
                },
              ],
              text: 'link',
              type: 'text',
            },
            {
              text: '.',
              type: 'text',
            },
          ],
          type: 'paragraph',
        },
      ],
    });
  });

  it('allows custom heading level', () => {
    const markdown = '## Custom Heading';
    const result = markdownToStoryblokRichtext(markdown, {
      extensions: {
        heading: {
          attributeParsers: {
            level: () => 5,
          },
        },
      },
    });
    expect(result).toMatchObject({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 5 },
          content: [
            { type: 'text', text: 'Custom Heading' },
          ],
        },
      ],
    });
  });

  it('customizes paragraph extension to be center aligned', () => {
    const md = 'Paragraph with custom attr.';
    const result = markdownToStoryblokRichtext(md, {
      extensions: {
        paragraph: {
          attributeParsers: {
            textAlign: () => 'center',
          },
        },
      },
    });
    expect(result).toMatchObject({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { textAlign: 'center' },
          content: [{ type: 'text', text: 'Paragraph with custom attr.' }],
        },
      ],
    });
  });
});
