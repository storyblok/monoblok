import { describe, expect, it, vi } from 'vitest';
import { htmlToStoryblokRichtext } from './html-parser';
import Heading from '@tiptap/extension-heading';

describe('htmlToStoryblokRichtext', () => {
  it('parses headings', () => {
    const html = '<h1>Heading 1</h1><h2>Heading 2</h2>';
    const result = htmlToStoryblokRichtext(html);
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
    const html = '<p>This is a paragraph.</p>';
    const result = htmlToStoryblokRichtext(html);
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
    const html = '<p><strong>bold</strong> and <em>italic</em></p>';
    const result = htmlToStoryblokRichtext(html);
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
    const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
    const result = htmlToStoryblokRichtext(html);
    expect(result).toMatchObject({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'Item 1' },
                  ],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'Item 2' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it('parses ordered lists', () => {
    const html = '<ol><li>First</li><li>Second</li></ol>';
    const result = htmlToStoryblokRichtext(html);
    expect(result).toMatchObject({
      type: 'doc',
      content: [
        {
          type: 'orderedList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'First' },
                  ],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'Second' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it('parses blockquotes', () => {
    const html = '<blockquote>This is a blockquote.</blockquote>';
    const result = htmlToStoryblokRichtext(html);
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
    const html = '<blockquote>A blockquote with <strong>bold</strong> text.</blockquote>';
    const result = htmlToStoryblokRichtext(html);
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

  it('parses code blocks', () => {
    const warn = vi.spyOn(console, 'warn');

    const html = '<pre><code class="language-js">const foo = "bar";\nconsole.log(foo);\n</code></pre>';
    const result = htmlToStoryblokRichtext(html);
    expect(warn).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      type: 'doc',
      content: [
        {
          type: 'codeBlock',
          attrs: { language: 'js' },
          content: [
            { type: 'text', text: 'const foo = "bar";\nconsole.log(foo);\n' },
          ],
        },
      ],
    });
  });

  it('parses tables', () => {
    const html = `<table><thead><tr><th>Header 1</th><th>Header 2</th><th>Header 3</th></tr></thead><tbody><tr><td>R1C1</td><td>R1C2</td><td>R1C3</td></tr><tr><td><strong>R2C1</strong></td><td><em>R2C2</em></td><td>R2C3</td></tr><tr><td>R3C1</td><td>R3C2</td><td>R3C3</td></tr></tbody></table>`;
    const result = htmlToStoryblokRichtext(html);
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
    const html = '<p>This is a <a href="https://www.storyblok.com/">Storyblok link</a>.</p>';
    const result = htmlToStoryblokRichtext(html);
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

  it.skip('distinguishes between anchor and link', () => { // TODO
    const result = htmlToStoryblokRichtext(
      '<p><a id="some-id">Anchor</a><a href="/home">Link</a></p>',
    );
    expect(result).toEqual({
      type: 'doc',
      content: [
        {
          text: 'Anchor',
          type: 'text',
          marks: [
            {
              type: 'anchor',
              attrs: {
                anchor: 'some-id',
              },
              content: [],
            },
          ],
        },
        {
          text: 'Link',
          type: 'text',
          marks: [
            {
              type: 'link',
              attrs: {
                href: '/home',
              },
              content: [],
            },
          ],
        },
      ],
    });
  });

  it('parses strikethrough (delete, s) marks', () => {
    const html = '<p>This is <del>deleted text</del> <s>deleted text</s>.</p>';
    const result = htmlToStoryblokRichtext(html);
    expect(result).toMatchObject({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'This is ' },
            { type: 'text', text: 'deleted text', marks: [{ type: 'strike' }] },
            { type: 'text', text: ' ' },
            { type: 'text', text: 'deleted text', marks: [{ type: 'strike' }] },
            { type: 'text', text: '.' },
          ],
        },
      ],
    });
  });

  it('parses inline code', () => {
    const html = '<p>This is <code>inline code</code>.</p>';
    const result = htmlToStoryblokRichtext(html);
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

  it('parses images', () => {
    const html = '<img alt="Alt text for image" src="https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg" title="Image Title">';
    const result = htmlToStoryblokRichtext(html);
    expect(result).toMatchObject({
      type: 'doc',
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
    });
  });

  it('parses horizontal rules (thematic breaks)', () => {
    const html = '<p>Paragraph above.</p><hr /><p>Paragraph below.</p>';
    const result = htmlToStoryblokRichtext(html);
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
          type: 'horizontalRule',
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

  it('parses hard line breaks (break)', () => {
    const html = '<p>Line with a hard break here.<br />Next line after break.</p>';
    const result = htmlToStoryblokRichtext(html);
    expect(result).toMatchObject({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Line with a hard break here.' },
            { type: 'hardBreak' },
            { type: 'text', text: 'Next line after break.' },
          ],
        },
      ],
    });
  });

  it('parses multiple marks on one node', () => {
    const md = [
      '<p><strong><em>bold and italic</em></strong></p>',
      '<p><strong>bold and <em>italic</em></strong></p>',
      '<p><em><strong>italic and bold</strong></em></p>',
      '<p><strong><a href="https://bold.storyblok.com">bold link</a></strong></p>',
      '<p><a href="https://bold.storyblok.com"><strong>bold link 2</strong></a></p>',
      '<p><em><a href="https://italic.storyblok.com">italic link</a></em></p>',
      '<p><strong><em><a href="https://bold-italic.storyblok.com">bold and italic link</a></em></strong></p>',
      '<p><a href="https://bold-italic.storyblok.com"><strong>bold </strong><em>and italic link</em></a></p>',
      '<p><a href="https://mixed.storyblok.com"><strong>bold</strong>, normal <em>and italic link</em></a></p>',
    ].join('\n');
    const result = htmlToStoryblokRichtext(md);
    expect(result).toMatchObject({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'bold and italic',
              marks: [
                { type: 'bold' },
                { type: 'italic' },
              ],
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'bold and ',
              marks: [{ type: 'bold' }],
            },
            {
              type: 'text',
              text: 'italic',
              marks: [
                { type: 'bold' },
                { type: 'italic' },
              ],
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'italic and bold',
              marks: [
                { type: 'bold' },
                { type: 'italic' },
              ],
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: 'https://bold.storyblok.com',
                  },
                },
                {
                  type: 'bold',
                },
              ],
              text: 'bold link',
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: 'https://bold.storyblok.com',
                  },
                },
                {
                  type: 'bold',
                },
              ],
              text: 'bold link 2',
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: 'https://italic.storyblok.com',
                  },
                },
                {
                  type: 'italic',
                },
              ],
              text: 'italic link',
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: 'https://bold-italic.storyblok.com',
                  },
                },
                { type: 'bold' },
                { type: 'italic' },
              ],
              text: 'bold and italic link',
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: 'https://bold-italic.storyblok.com',
                  },
                },
                {
                  type: 'bold',
                },
              ],
              text: 'bold ',
            },
            {
              type: 'text',
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: 'https://bold-italic.storyblok.com',
                  },
                },
                {
                  type: 'italic',
                },
              ],
              text: 'and italic link',
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: 'https://mixed.storyblok.com',
                  },
                },
                {
                  type: 'bold',
                },
              ],
              text: 'bold',
            },
            {
              type: 'text',
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: 'https://mixed.storyblok.com',
                  },
                },
              ],
              text: ', normal ',
            },
            {
              type: 'text',
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: 'https://mixed.storyblok.com',
                  },
                },
                {
                  type: 'italic',
                },
              ],
              text: 'and italic link',
            },
          ],
        },
      ],
    });
  });

  it('does not preserve unsupported attributes by default', () => {
    const resultDefault = htmlToStoryblokRichtext(
      '<p class="unsupported">Hello <a data-unsupported-custom-attribute="whatever" target="_blank" href="/home">world!</a></p>',
    );
    expect(resultDefault).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              text: 'Hello ',
              type: 'text',
            },
            {
              text: 'world!',
              type: 'text',
              marks: [
                {
                  type: 'link',
                  attrs: {
                    class: null,
                    href: '/home',
                    rel: 'noopener noreferrer nofollow',
                    target: '_blank',
                  },
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it.skip('preserves custom attributes on <a> when allowCustomAttributes is true', () => { // TODO
    const resultAllowCustomAttributes = htmlToStoryblokRichtext(
      '<p class="unsupported">Hello <a data-supported-custom-attribute="whatever" target="_blank" href="/home">world!</a></p>',
      {
        allowCustomAttributes: true,
      },
    );
    expect(resultAllowCustomAttributes).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              text: 'Hello ',
              type: 'text',
            },
            {
              text: 'world!',
              type: 'text',
              marks: [
                {
                  type: 'link',
                  attrs: {
                    custom: {
                      'data-supported-custom-attribute': 'whatever',
                    },
                    href: '/home',
                    target: '_blank',
                  },
                  content: [],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it.skip('preserves styleOptions on inline elements', () => { // TODO
    const resultStyleOptions = htmlToStoryblokRichtext(
      '<p>foo <span class="style-1 invalid-style">bar</span></p><p>baz <span class="style-2">qux</span></p><p>corge <span class="style-3">grault</span> <a href="/home" class="style-1">Home</a></p>',
      {
        styleOptions: [
          { name: 'Style1', value: 'style-1' },
          { name: 'Style2', value: 'style-2' },
        ],
      },
    );
    expect(resultStyleOptions).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'foo ',
            },
            {
              type: 'text',
              marks: [
                {
                  type: 'styled',
                  attrs: {
                    class: 'style-1',
                  },
                  content: [],
                },
              ],
              text: 'bar',
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'baz ',
            },
            {
              type: 'text',
              marks: [
                {
                  type: 'styled',
                  attrs: {
                    class: 'style-2',
                  },
                  content: [],
                },
              ],
              text: 'qux',
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'corge ',
            },
            {
              type: 'text',
              text: 'grault',
            },
            {
              type: 'text',
              text: ' ',
            },
            {
              text: 'Home',
              type: 'text',
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: '/home',
                  },
                  content: [],
                },
                {
                  type: 'styled',
                  attrs: {
                    class: 'style-1',
                  },
                  content: [],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it.skip('warns the user when transformation leads to data loss', () => { // TODO
    const warn = vi.spyOn(console, 'warn');

    const unsupportedAttributes = '<p id="foo" class="unsupported">Hello <a target="_blank" href="/home">world!</a></p>';
    const unsupportedStyles = '<p>Hello <span class="supported unsupported">world!</span></p>';
    htmlToStoryblokRichtext(
      [unsupportedAttributes, unsupportedStyles].join(''),
      {
        styleOptions: [
          { name: 'supported', value: 'supported' },
        ],
      },
    );

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[StoryblokRichText] - `id` "foo" on `<p>` can not be transformed to rich text.'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[StoryblokRichText] - `class` "unsupported" on `<p>` can not be transformed to rich text.'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[StoryblokRichText] - `class` "unsupported" on `<span>` can not be transformed to rich text.'));
  });

  it.skip('throws an error when transformation is not supported', () => { // TODO
    const unsupportedElements = [
      '<div>Hello world!</div>',
      '<iframe src="https://example.com"></iframe>',
      '<script>alert("test")</script>',
    ];
    for (const element of unsupportedElements) {
      expect(() => htmlToStoryblokRichtext(element))
        .toThrowError(/No resolver specified for tag "(div|iframe|script)"!/);
    }
  });

  it.skip('throws an error when the source HTML is invalid', () => { // TODO
    const html = '<ul><li>Not closed!<p></ul>';
    expect(() => htmlToStoryblokRichtext(html))
      .toThrowError('Invalid HTML: The provided string could not be parsed. Common causes include unclosed or mismatched tags!');
  });

  it('allows using custom extensions', () => {
    const html = '<h2>Custom Heading</h2>';
    const result = htmlToStoryblokRichtext(html, {
      tipTapExtensions: [
        Heading.extend({
          parseHTML() {
            return [{
              tag: `h2`,
              attrs: { level: 99 },
            }];
          },
        }),
      ],
    });
    expect(result).toMatchObject({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 99 },
          content: [
            { type: 'text', text: 'Custom Heading' },
          ],
        },
      ],
    });
  });

  it('normalizes whitespace', () => {
    const html = '<h2>Heading</h2>\n<p>paragraph\n1</p>\r\n<p>paragraph 2</p><p><strong>paragraph</strong>\n<strong>2</strong></p>\n<hr />\n<pre>Hello\nworld</pre>';
    const result = htmlToStoryblokRichtext(html);
    expect(result).toMatchObject({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Heading' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'paragraph 1' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'paragraph 2' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'paragraph', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' ' },
            { type: 'text', text: '2', marks: [{ type: 'bold' }] },
          ],
        },
        {
          type: 'horizontalRule',
        },
        {
          type: 'codeBlock',
          attrs: {},
          content: [{ type: 'text', text: 'Hello\nworld' }],
        },
      ],
    });
  });
});
