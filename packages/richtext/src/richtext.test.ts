import { describe, expect, it } from 'vitest';
import { richTextResolver } from './richtext';
import { createTextVNode, h } from 'vue';
import type { VNode } from 'vue';
import { BlockTypes, MarkTypes, type StoryblokRichTextNode, type StoryblokRichTextNodeResolver } from './types';
import { StoryblokComponent } from '@storyblok/vue';

describe('richtext', () => {
  describe('document', () => {
    it('should not render any wrapper tag', () => {
      const { render } = richTextResolver({});
      const richdata = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Hey ',
              },
            ],
          },
          {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: 'nested',
                  },
                ],
              },
            ],
          },
        ],
      };

      const html = render(richdata as StoryblokRichTextNode<string>);
      expect(html).toBe('<p>Hey </p><p>nested</p>');
    });
  });
  describe('blocktypes', () => {
    it('should render a paragraph', async () => {
      const { render } = richTextResolver({});
      const paragraph = {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Hello, world!',
          },
        ],
      };
      const html = render(paragraph as StoryblokRichTextNode<string>);
      expect(html).toBe('<p>Hello, world!</p>');
    });

    it('should render a paragraph with key property', async () => {
      const { render } = richTextResolver({
        keyedResolvers: true,
      });
      const paragraph = {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Hello, world!',
          },
        ],
      };
      const html = render(paragraph as StoryblokRichTextNode<string>);
      expect(html).toBe('<p key="p-0">Hello, world!</p>');
    });

    it('should render a heading 1', async () => {
      const { render } = richTextResolver({});
      const heading = {
        type: 'heading',
        attrs: {
          level: 1,
        },
        content: [
          {
            text: 'Headline 1',
            type: 'text',
          },
        ],
      };
      const html = render(heading as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<h1>Headline 1</h1>');
    });

    it('should render heading with key property', async () => {
      const { render } = richTextResolver({
        keyedResolvers: true,
      });
      const heading = {
        type: 'heading',
        attrs: {
          level: 2,
        },
        content: [
          {
            text: 'Headline 2',
            type: 'text',
          },
        ],
      };
      const html = render(heading as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<h2 key="h2-0">Headline 2</h2>');
    });

    it('should render an unordered list', async () => {
      const { render } = richTextResolver({});
      const list = {
        type: 'bullet_list',
        content: [
          {
            type: 'list_item',
            content: [
              {
                type: 'text',
                text: 'Item 1',
              },
            ],
          },
          {
            type: 'list_item',
            content: [
              {
                type: 'text',
                text: 'Item 2',
              },
            ],
          },
        ],
      };
      const html = render(list as StoryblokRichTextNode<string>);
      expect(html).toBe('<ul><li>Item 1</li><li>Item 2</li></ul>');
    });

    it('should render list items with keys if keyedResolvers is true', async () => {
      const { render } = richTextResolver({
        keyedResolvers: true,
      });
      const list = {
        type: 'bullet_list',
        content: [
          {
            type: 'list_item',
            content: [
              {
                type: 'text',
                text: 'Item 1',
              },
            ],
          },
          {
            type: 'list_item',
            content: [
              {
                type: 'text',
                text: 'Item 2',
              },
            ],
          },
        ],
      };
      const html = render(list as StoryblokRichTextNode<string>);
      expect(html).toBe('<ul key="ul-0"><li key="li-0">Item 1</li><li key="li-1">Item 2</li></ul>');
    });

    it('should render an ordered list', async () => {
      const { render } = richTextResolver({});
      const list = {
        type: 'ordered_list',
        attrs: { order: 1 },
        content: [
          {
            type: 'list_item',
            content: [
              {
                type: 'text',
                text: 'Item 1',
              },
            ],
          },
          {
            type: 'list_item',
            content: [
              {
                type: 'text',
                text: 'Item 2',
              },
            ],
          },
        ],
      };
      const html = render(list as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<ol order="1"><li>Item 1</li><li>Item 2</li></ol>');
    });

    it('should render an image with attrs', async () => {
      const { render } = richTextResolver({});
      const image = {
        type: 'image',
        attrs: {
          src: 'https://example.com/image.jpg',
          alt: 'An image',
          copyright: '© Storyblok',
          source: 'Storyblok',
          title: 'An image',
          meta_data: {
            alt: 'An image',
            copyright: '© Storyblok',
            source: 'Storyblok',
          },
        },
      };
      const html = render(image as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<img src="https://example.com/image.jpg" alt="An image" title="An image">');
    });

    it('should render an image with key property', async () => {
      const { render } = richTextResolver({
        keyedResolvers: true,
      });
      const image = {
        type: 'image',
        attrs: {
          src: 'https://example.com/image.jpg',
          alt: 'An image',
        },
      };
      const html = render(image as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<img src="https://example.com/image.jpg" alt="An image" key="img-0">');
    });

    it('should optimize image attrs', async () => {
      const { render } = richTextResolver({
        optimizeImages: true,
      });
      const image = {
        type: 'image',
        attrs: {
          src: 'https://example.com/image.jpg',
          alt: 'An image',
          title: 'An image',
          meta_data: {
            alt: 'An image',
            title: 'An image',
          },
        },
      };
      const html = render(image as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<img src="https://example.com/image.jpg/m/" alt="An image" title="An image">');
    });

    it('should render self-closing tags', async () => {
      const { render } = richTextResolver({});
      const selfClosingBlockTypes = [
        'HR',
        'BR',
        'IMAGE',
      ];
      const tagMap = {
        HR: 'hr',
        BR: 'br',
        IMAGE: 'img',
      };
      selfClosingBlockTypes.forEach((type) => {
        const node = {
          type: BlockTypes[type as keyof typeof BlockTypes],
        };
        const html = render(node as StoryblokRichTextNode<string>);

        expect(html).toBe(`<${tagMap[type]}>`);
      });
    });

    it('should render an emoji', async () => {
      const { render } = richTextResolver({});
      const emoji = {
        type: 'emoji',
        attrs: {
          emoji: '🚀',
          name: 'smile',
        },
      };
      const html = render(emoji as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<span data-type="emoji" data-name="smile" data-emoji="🚀"><img src="undefined" alt="undefined" style="width: 1.25em; height: 1.25em; vertical-align: text-top" draggable="false" loading="lazy"></span>');
    });

    it('should render a code block', async () => {
      const { render } = richTextResolver({});
      const code = {
        type: 'code_block',
        content: [
          {
            text: 'console.log("Hello, world!")',
            type: 'text',
          },
        ],
      };
      const html = render(code as StoryblokRichTextNode<string>);
      expect(html).toBe('<pre><code>console.log(&quot;Hello, world!&quot;)</code></pre>');
    });

    it('should render a horizontal rule', async () => {
      const { render } = richTextResolver({});
      const hr = {
        type: 'horizontal_rule',
      };
      const html = render(hr as StoryblokRichTextNode<string>);
      expect(html).toBe('<hr>');
    });

    it('should render a break', async () => {
      const { render } = richTextResolver({});
      const br = {
        type: 'hard_break',
      };
      const html = render(br as StoryblokRichTextNode<string>);
      expect(html).toBe('<br>');
    });

    it('should render a quote', async () => {
      const { render } = richTextResolver({});
      const quote = {
        type: 'blockquote',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Quote',
              },
            ],
          },
        ],
      };
      const html = render(quote as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<blockquote><p>Quote</p></blockquote>');
    });

    it('should render a table', async () => {
      const { render } = richTextResolver({});
      const table = {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                attrs: {
                  colspan: 1,
                  rowspan: 1,
                  colwidth: null,
                },
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      {
                        text: 'Cell 1',
                        type: 'text',
                      },
                    ],
                  },
                ],
              },
              {
                type: 'tableCell',
                attrs: {
                  colspan: 1,
                  rowspan: 1,
                  colwidth: null,
                },
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      {
                        text: 'Cell 2',
                        type: 'text',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };
      const html = render(table as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<table><tbody><tr><td><p>Cell 1</p></td><td><p>Cell 2</p></td></tr></tbody></table>');
    });

    it('should render a table with colspan and rowspan', async () => {
      const { render } = richTextResolver({});
      const table = {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                attrs: {
                  colspan: 2,
                  rowspan: 1,
                  colwidth: null,
                },
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      {
                        text: 'Merged Cell',
                        type: 'text',
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                attrs: {
                  colspan: 1,
                  rowspan: 1,
                  colwidth: null,
                },
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      {
                        text: 'Cell 1',
                        type: 'text',
                      },
                    ],
                  },
                ],
              },
              {
                type: 'tableCell',
                attrs: {
                  colspan: 1,
                  rowspan: 1,
                  colwidth: null,
                },
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      {
                        text: 'Cell 2',
                        type: 'text',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };
      const html = render(table as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<table><tbody><tr><td colspan="2"><p>Merged Cell</p></td></tr><tr><td><p>Cell 1</p></td><td><p>Cell 2</p></td></tr></tbody></table>');
    });

    it('should render a table with colwidth', async () => {
      const { render } = richTextResolver({});
      const table = {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                attrs: {
                  colspan: 1,
                  rowspan: 1,
                  colwidth: 200,
                },
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      {
                        text: 'Fixed Width Cell',
                        type: 'text',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };
      const html = render(table as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<table><tbody><tr><td style="width: 200px;"><p>Fixed Width Cell</p></td></tr></tbody></table>');
    });

    it('should render a table with keyed resolvers', async () => {
      const { render } = richTextResolver({
        keyedResolvers: true,
      });
      const table = {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                attrs: {
                  colspan: 1,
                  rowspan: 1,
                  colwidth: null,
                },
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      {
                        text: 'Cell 1',
                        type: 'text',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };
      const html = render(table as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<table key="table-0"><tbody key="tbody-0"><tr key="tr-0"><td key="td-0"><p key="p-0">Cell 1</p></td></tr></tbody></table>');
    });

    it('should render a table cell with background color', async () => {
      const { render } = richTextResolver({});
      const table = {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                attrs: {
                  colspan: 1,
                  rowspan: 1,
                  colwidth: null,
                  backgroundColor: '#F11F1F',
                },
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      {
                        text: 'Colored Cell',
                        type: 'text',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };
      const html = render(table as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<table><tbody><tr><td style="background-color: #F11F1F;"><p>Colored Cell</p></td></tr></tbody></table>');
    });

    it('should render a table cell with both width and background color', async () => {
      const { render } = richTextResolver({});
      const table = {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                attrs: {
                  colspan: 1,
                  rowspan: 1,
                  colwidth: 200,
                  backgroundColor: '#F11F1F',
                },
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      {
                        text: 'Styled Cell',
                        type: 'text',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };
      const html = render(table as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<table><tbody><tr><td style="width: 200px; background-color: #F11F1F;"><p>Styled Cell</p></td></tr></tbody></table>');
    });

    it('should render a table with header cells', async () => {
      const { render } = richTextResolver({});
      const table = {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableHeader',
                attrs: {
                  colspan: 1,
                  rowspan: 1,
                  colwidth: null,
                  backgroundColor: '#F5F5F5',
                },
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      {
                        text: 'Header Cell',
                        type: 'text',
                      },
                    ],
                  },
                ],
              },
              {
                type: 'tableHeader',
                attrs: {
                  colspan: 1,
                  rowspan: 1,
                  colwidth: null,
                },
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      {
                        text: 'Another Header',
                        type: 'text',
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                attrs: {
                  colspan: 1,
                  rowspan: 1,
                  colwidth: null,
                },
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      {
                        text: 'Regular Cell',
                        type: 'text',
                      },
                    ],
                  },
                ],
              },
              {
                type: 'tableCell',
                attrs: {
                  colspan: 1,
                  rowspan: 1,
                  colwidth: null,
                },
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      {
                        text: 'Another Cell',
                        type: 'text',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };
      const html = render(table as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<table><tbody><tr><th style="background-color: #F5F5F5;"><p>Header Cell</p></th><th><p>Another Header</p></th></tr><tr><td><p>Regular Cell</p></td><td><p>Another Cell</p></td></tr></tbody></table>');
    });
  });

  describe('textTypes & MarksTypes', () => {
    it('should render text with marks', async () => {
      const { render } = richTextResolver({});
      const text = {
        type: 'paragraph',
        content: [
          {
            text: 'Bold and italic',
            type: 'text',
            marks: [{ type: 'bold' }, { type: 'italic' }],
          },
        ],
      };
      const html = render(text as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<p><em><strong>Bold and italic</strong></em></p>');
    });

    it('should render text with styled marks', async () => {
      const { render } = richTextResolver({});
      const text = {
        type: 'paragraph',
        content: [
          {
            text: 'Bold and italic',
            type: 'text',
            marks: [{ type: 'styled', attrs: { color: 'red' } }, { type: 'styled', attrs: { color: 'blue' } }],
          },
        ],
      };
      const html = render(text as unknown as StoryblokRichTextNode<string>);
      // Update the expected HTML to reflect the styles
      expect(html).toBe('<p><span style="color: blue"><span style="color: red">Bold and italic</span></span></p>');
    });

    it('should render an external link', async () => {
      const { render } = richTextResolver({});
      const link = {
        text: 'External link',
        type: 'text',
        marks: [
          {
            type: 'link',
            attrs: {
              href: 'https://alvarosaburido.dev',
              target: '_blank',
              linktype: 'url',
            },
          },
        ],
      };
      const html = render(link as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<a target="_blank" href="https://alvarosaburido.dev">External link</a>');
    });

    it('should render an anchor link', async () => {
      const { render } = richTextResolver({});
      const link = {
        text: 'Anchor link',
        type: 'text',
        marks: [
          {
            type: 'link',
            attrs: {
              href: '/home',
              target: '_self',
              anchor: 'anchor',
              linktype: 'story',
            },
          },
        ],
      };
      const html = render(link as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<a target="_self" href="/home#anchor">Anchor link</a>');
    });

    it('should render an email link', async () => {
      const { render } = richTextResolver({});
      const link = {
        text: 'hola@alvarosaburido.dev',
        type: 'text',
        marks: [
          {
            type: 'link',
            attrs: {
              href: 'hola@alvarosaburido.dev',
              linktype: 'email',
            },
          },
        ],
      };
      const html = render(link as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<a href="mailto:hola@alvarosaburido.dev">hola@alvarosaburido.dev</a>');
    });

    it('should render an internal link', async () => {
      const { render } = richTextResolver({});
      const link = {
        text: 'Internal Link',
        type: 'text',
        marks: [
          {
            type: 'link',
            attrs: {
              href: '/',
              uuid: '2bbf3ee7-acbe-401c-ade5-cf33e6e0babb',
              anchor: null,
              target: '_blank',
              linktype: 'story',
            },
          },
        ],
      };
      const html = render(link as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<a uuid="2bbf3ee7-acbe-401c-ade5-cf33e6e0babb" target="_blank" href="/">Internal Link</a>');
    });

    it('should render an asset link', async () => {
      const { render } = richTextResolver({});
      const link = {
        text: 'Asset link',
        type: 'text',
        marks: [
          {
            type: 'link',
            attrs: {
              href: 'https://a.storyblok.com/f/67536/400x303/ccbe9ca7b3/nuxt-logo.png',
              linktype: 'asset',
            },
          },
        ],
      };
      const html = render(link as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<a href="https://a.storyblok.com/f/67536/400x303/ccbe9ca7b3/nuxt-logo.png">Asset link</a>');
    });

    it('should render a key when keyedResolvers is set', async () => {
      const { render } = richTextResolver({ keyedResolvers: true });
      const link = {
        text: 'Link text',
        type: 'text',
        marks: [
          {
            type: 'link',
            attrs: {
              href: 'https://url.com',
              linktype: 'url',
            },
          },
        ],
      };
      const html = render(link as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<a href="https://url.com" key="a-0">Link text</a>');
    });

    it('should not render href when is empty', async () => {
      const { render } = richTextResolver({ });
      const link: any = {
        text: 'Link text',
        type: 'text',
        marks: [
          {
            type: 'link',
            attrs: {
              linktype: 'url',
            },
          },
        ],
      };
      const html = render(link as unknown as StoryblokRichTextNode<string>);
      link.marks[0].attrs.href = '';
      const html2 = render(link as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<a>Link text</a>');
      expect(html2).toBe('<a>Link text</a>');
    });

    it('should render as a URL when linktype is not defined', async () => {
      const { render } = richTextResolver({ });
      const link = {
        text: 'Link text',
        type: 'text',
        marks: [
          {
            type: 'link',
            attrs: {
              href: 'https://url.com',
            },
          },
        ],
      };
      const html = render(link as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<a href="https://url.com">Link text</a>');
    });

    it('should render a bold text', async () => {
      const { render } = richTextResolver({});
      const bold = {
        text: 'Bold',
        type: 'text',
        marks: [{ type: 'bold' }],
      };
      const html = render(bold as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<strong>Bold</strong>');
    });

    it('should render a bold text with key property', async () => {
      const { render } = richTextResolver({
        keyedResolvers: true,
      });
      const bold = {
        text: 'Bold',
        type: 'text',
        marks: [{ type: 'bold' }],
      };
      const html = render(bold as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<strong key="strong-0">Bold</strong>');
    });

    it('should render an italic text', async () => {
      const { render } = richTextResolver({});
      const italic = {
        text: 'Italic',
        type: 'text',
        marks: [{ type: 'italic' }],
      };
      const html = render(italic as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<em>Italic</em>');
    });

    it('should render an italic text with key', async () => {
      const { render } = richTextResolver({
        keyedResolvers: true,
      });
      const italic = {
        text: 'Italic',
        type: 'text',
        marks: [{ type: 'italic' }],
      };
      const html = render(italic as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<em key="em-0">Italic</em>');
    });

    it('should render a underline text', async () => {
      const { render } = richTextResolver({});
      const underline = {
        text: 'Underline',
        type: 'text',
        marks: [{ type: 'underline' }],
      };
      const html = render(underline as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<u>Underline</u>');
    });

    it('should render a underline text with key', async () => {
      const { render } = richTextResolver({
        keyedResolvers: true,
      });
      const underline = {
        text: 'Underline',
        type: 'text',
        marks: [{ type: 'underline' }],
      };
      const html = render(underline as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<u key="u-0">Underline</u>');
    });

    it('should render a strike text', async () => {
      const { render } = richTextResolver({});
      const strike = {
        text: 'Strike',
        type: 'text',
        marks: [{ type: 'strike' }],
      };
      const html = render(strike as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<s>Strike</s>');
    });

    it('should render a strike text with key', async () => {
      const { render } = richTextResolver({
        keyedResolvers: true,
      });
      const strike = {
        text: 'Strike',
        type: 'text',
        marks: [{ type: 'strike' }],
      };
      const html = render(strike as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<s key="s-0">Strike</s>');
    });

    it('should render a code text', async () => {
      const { render } = richTextResolver({});
      const code = {
        text: 'Code',
        type: 'text',
        marks: [{ type: 'code' }],
      };
      const html = render(code as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<code>Code</code>');
    });

    it('should render a code text with key', async () => {
      const { render } = richTextResolver({
        keyedResolvers: true,
      });
      const code = {
        text: 'Code',
        type: 'text',
        marks: [{ type: 'code' }],
      };
      const html = render(code as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<code key="code-0">Code</code>');
    });

    it('should render a superscript text', async () => {
      const { render } = richTextResolver({});
      const superscript = {
        text: 'Superscript',
        type: 'text',
        marks: [{ type: 'superscript' }],
      };
      const html = render(superscript as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<sup>Superscript</sup>');
    });

    it('should render a superscript text with key', async () => {
      const { render } = richTextResolver({
        keyedResolvers: true,
      });
      const superscript = {
        text: 'Superscript',
        type: 'text',
        marks: [{ type: 'superscript' }],
      };
      const html = render(superscript as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<sup key="sup-0">Superscript</sup>');
    });

    it('should render a subscript text', async () => {
      const { render } = richTextResolver({});
      const subscript = {
        text: 'Subscript',
        type: 'text',
        marks: [{ type: 'subscript' }],
      };
      const html = render(subscript as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<sub>Subscript</sub>');
    });

    it('should render a subscript text with key', async () => {
      const { render } = richTextResolver({
        keyedResolvers: true,
      });
      const subscript = {
        text: 'Subscript',
        type: 'text',
        marks: [{ type: 'subscript' }],
      };
      const html = render(subscript as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<sub key="sub-0">Subscript</sub>');
    });

    it('should render a highlight text', async () => {
      const { render } = richTextResolver({});
      const highlight = {
        text: 'Highlight',
        type: 'text',
        marks: [{ type: 'highlight' }],
      };
      const html = render(highlight as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<mark>Highlight</mark>');
    });

    it('should render a highlight text with key', async () => {
      const { render } = richTextResolver({
        keyedResolvers: true,
      });
      const highlight = {
        text: 'Highlight',
        type: 'text',
        marks: [{ type: 'highlight' }],
      };
      const html = render(highlight as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<mark key="mark-0">Highlight</mark>');
    });

    it('should render text with multiple marks and keys', () => {
      const text = {
        type: 'paragraph',
        content: [{
          type: 'text',
          text: 'Styled text',
          marks: [
            { type: 'bold' },
            { type: 'italic' },
          ],
        }],
      };
      const html = richTextResolver<string>({ keyedResolvers: true }).render(text as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<p key="p-0"><em key="em-0"><strong key="strong-0">Styled text</strong></em></p>');
    });

    it('should render an emoji with keys', async () => {
      const { render } = richTextResolver({
        keyedResolvers: true,
      });
      const emoji = {
        type: 'emoji',
        attrs: {
          emoji: '😊',
          name: 'smile',
          fallbackImage: 'smile.png',
        },
      };
      const html = render(emoji as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<span data-type="emoji" data-name="smile" data-emoji="😊" key="span-0"><img src="smile.png" alt="undefined" style="width: 1.25em; height: 1.25em; vertical-align: text-top" draggable="false" loading="lazy" key="img-0"></span>');
    });

    it('should render a code block with keys', () => {
      const codeBlock = {
        type: 'code_block',
        content: [{ type: 'text', text: 'const x = 42;' }],
      };
      const html = richTextResolver<string>({ keyedResolvers: true }).render(codeBlock as StoryblokRichTextNode<string>);
      expect(html).toBe('<pre key="pre-0"><code key="code-0">const x = 42;</code></pre>');
    });
  });
  describe('frameworks', () => {
    it('should use the framework render function', async () => {
      const { render } = richTextResolver({
        renderFn: h,
      });
      const paragraph = {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Hello, world!',
          },
        ],
      };
      const vnode = render(paragraph as StoryblokRichTextNode<VNode>);
      expect(vnode.__v_isVNode).toBeTruthy();
      expect(vnode.type).toBe('p');
    });
    it('should use the framework text function', async () => {
      const { render } = richTextResolver({
        renderFn: h,
        textFn: createTextVNode,
      });
      const paragraph = {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Hello, world!',
          },
        ],
      };
      const vnode = render(paragraph as StoryblokRichTextNode<VNode>);
      expect(vnode?.children[0].children).toBe('Hello, world!');
    });
    it('should overwrite a resolver', async () => {
      const RouterLink = h('span');

      const { render } = richTextResolver({
        resolvers: {
          [MarkTypes.LINK]: (node: StoryblokRichTextNode<VNode>) => h(RouterLink, {
            to: node.attrs?.href,
            target: node.attrs?.target,
          }, node.text),
        },
      });
      const link = {
        text: 'Internal Link',
        type: 'text',
        marks: [
          {
            type: 'link',
            attrs: {
              href: '/about',
              uuid: '2bbf3ee7-acbe-401c-ade5-cf33e6e0babb',
              anchor: null,
              target: '_blank',
              linktype: 'story',
            },
          },
        ],
      };
      const node = render(link as unknown as StoryblokRichTextNode<VNode>);
      expect(node.type).toBe('span');
      expect(node?.props?.to).toBe('/about');
    });

    it('should render a blok component', async () => {
      const componentResolver: StoryblokRichTextNodeResolver<VNode> = (node: StoryblokRichTextNode<VNode>): VNode => {
        return h(StoryblokComponent, {
          blok: node?.attrs?.body[0],
          id: node.attrs?.id,
        }, node.children);
      };
      const { render } = richTextResolver({
        renderFn: h,
        textFn: createTextVNode,
        resolvers: {
          [BlockTypes.COMPONENT]: componentResolver,
        },
      });
      const paragraph = {
        type: 'blok',
        attrs: {
          id: '489f2970-6787-486a-97c3-6f1e8a99b7a9',
          body: [
            {
              sub: [],
              _uid: 'i-134324ee-1754-48be-93df-02df1e394733',
              title: 'Second button!',
              component: 'test-button',
            },
            {
              sub: [],
              _uid: 'i-437c2948-0be9-442e-949d-a11c79736aa6',
              title: 'My Button ',
              component: 'test-button',
            },
          ],
        },
      };
      const vnode = render(paragraph as unknown as StoryblokRichTextNode<VNode>);
      expect(vnode?.props?.blok.component).toBe('test-button');
    });
  });
});

describe('richTextResolver', () => {
  describe('render', () => {
    it('should render a paragraph with text', () => {
      const paragraph = {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Hello, world!' }],
      };
      const { render } = richTextResolver<string>({});
      const html = render(paragraph as StoryblokRichTextNode<string>);
      expect(html).toBe('<p>Hello, world!</p>');
    });

    it('should render a paragraph with text and keys', () => {
      const paragraph = {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Hello, world!' }],
      };
      const html = richTextResolver<string>({ keyedResolvers: true }).render(paragraph as StoryblokRichTextNode<string>);
      expect(html).toBe('<p key="p-0">Hello, world!</p>');
    });

    it('should render a list with items and keys', () => {
      const list = {
        type: 'bullet_list',
        content: [
          {
            type: 'list_item',
            content: [{ type: 'text', text: 'Item 1' }],
          },
          {
            type: 'list_item',
            content: [{ type: 'text', text: 'Item 2' }],
          },
        ],
      };
      const html = richTextResolver<string>({ keyedResolvers: true }).render(list as StoryblokRichTextNode<string>);
      expect(html).toBe('<ul key="ul-0"><li key="li-0">Item 1</li><li key="li-1">Item 2</li></ul>');
    });

    it('should render a heading with text and keys', () => {
      const heading = {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Hello, world!' }],
      };
      const html = richTextResolver<string>({ keyedResolvers: true }).render(heading as StoryblokRichTextNode<string>);
      expect(html).toBe('<h1 key="h1-0">Hello, world!</h1>');
    });

    it('should render a link with text and keys', () => {
      const link = {
        type: 'paragraph',
        content: [{
          type: 'text',
          text: 'Click me',
          marks: [{
            type: 'link',
            attrs: { href: 'https://example.com' },
          }],
        }],
      };
      const html = richTextResolver<string>({ keyedResolvers: true }).render(link as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<p key="p-0"><a href="https://example.com" key="a-0">Click me</a></p>');
    });

    it('should render text with multiple marks and keys', () => {
      const text = {
        type: 'paragraph',
        content: [{
          type: 'text',
          text: 'Styled text',
          marks: [
            { type: 'bold' },
            { type: 'italic' },
          ],
        }],
      };
      const html = richTextResolver<string>({ keyedResolvers: true }).render(text as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<p key="p-0"><em key="em-0"><strong key="strong-0">Styled text</strong></em></p>');
    });

    it('should render an emoji', async () => {
      const { render } = richTextResolver({});
      const emoji = {
        type: 'emoji',
        attrs: {
          emoji: '🚀',
          name: 'smile',
        },
      };
      const html = render(emoji as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<span data-type="emoji" data-name="smile" data-emoji="🚀"><img src="undefined" alt="undefined" style="width: 1.25em; height: 1.25em; vertical-align: text-top" draggable="false" loading="lazy"></span>');
    });

    it('should render an emoji with keys', async () => {
      const { render } = richTextResolver({
        keyedResolvers: true,
      });
      const emoji = {
        type: 'emoji',
        attrs: {
          emoji: '😊',
          name: 'smile',
          fallbackImage: 'smile.png',
        },
      };
      const html = render(emoji as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<span data-type="emoji" data-name="smile" data-emoji="😊" key="span-0"><img src="smile.png" alt="undefined" style="width: 1.25em; height: 1.25em; vertical-align: text-top" draggable="false" loading="lazy" key="img-0"></span>');
    });

    it('should render a code block with keys', () => {
      const codeBlock = {
        type: 'code_block',
        content: [{ type: 'text', text: 'const x = 42;' }],
      };
      const html = richTextResolver<string>({ keyedResolvers: true }).render(codeBlock as StoryblokRichTextNode<string>);
      expect(html).toBe('<pre key="pre-0"><code key="code-0">const x = 42;</code></pre>');
    });
  });
});
