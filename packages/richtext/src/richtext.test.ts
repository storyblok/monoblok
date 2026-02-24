import { describe, expect, it, vi } from 'vitest';
import { richTextResolver } from './richtext';
import { createTextVNode, h } from 'vue';
import type { VNode } from 'vue';
import type { StoryblokRichTextNode } from './types';
import { Mark, Node } from '@tiptap/core';
import Heading from '@tiptap/extension-heading';
import Bold from '@tiptap/extension-bold';
import { ComponentBlok } from './extensions/nodes';
import { getStoryblokExtensions } from './extensions';

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
      expect(html).toBe('<a href="https://alvarosaburido.dev" target="_blank">External link</a>');
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
      expect(html).toBe('<a href="/home#anchor" target="_self">Anchor link</a>');
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

    it('should not duplicate mailto: prefix when href already contains it', async () => {
      const { render } = richTextResolver({});
      const link = {
        text: 'hey@hoe.dev',
        type: 'text',
        marks: [
          {
            type: 'link',
            attrs: {
              href: 'mailto:hey@hoe.dev',
              linktype: 'email',
            },
          },
        ],
      };
      const html = render(link as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<a href="mailto:hey@hoe.dev">hey@hoe.dev</a>');
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
      expect(html).toBe('<a href="/" target="_blank">Internal Link</a>');
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

    it('should not render null attributes on links', async () => {
      const { render } = richTextResolver({});
      const link = {
        text: 'Hello',
        type: 'text',
        marks: [
          {
            type: 'link',
            attrs: {
              href: '/',
              uuid: null,
              anchor: null,
              target: null,
              linktype: 'url',
            },
          },
        ],
      };
      const html = render(link as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<a href="/">Hello</a>');
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

    it('should render anchor mark as span with id, not as a link', () => {
      const { render } = richTextResolver({});
      const text = {
        type: 'text',
        text: 'Anchored text',
        marks: [{ type: 'anchor', attrs: { id: 'my-section' } }],
      };
      const html = render(text as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<span id="my-section">Anchored text</span>');
    });

    it('should not leak language attribute onto pre element', () => {
      const { render } = richTextResolver({});
      const codeBlock = {
        type: 'code_block',
        attrs: { language: 'js' },
        content: [{ type: 'text', text: 'const x = 1;' }],
      };
      const html = render(codeBlock as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<pre><code class="language-js">const x = 1;</code></pre>');
      expect(html).not.toContain('language="js"');
    });

    it('should render a link with text, keys, and custom attrs', () => {
      const link = {
        type: 'paragraph',
        content: [{
          type: 'text',
          text: 'Click me',
          marks: [{
            type: 'link',
            attrs: {
              href: 'https://example.com',
              custom: {
                'data-custom': 'foo',
              },
            },
          }],
        }],
      };
      const html = richTextResolver<string>({ keyedResolvers: true }).render(link as unknown as StoryblokRichTextNode<string>);
      expect(html).toBe('<p key="p-0"><a href="https://example.com" data-custom="foo" key="a-0">Click me</a></p>');
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
    it('should render a mark with a Vue component via tiptapExtensions', () => {
      // Simulate a Vue component (like RouterLink)
      const RouterLink = { name: 'RouterLink', render: () => null };

      const CustomLink = Mark.create({
        name: 'link',
        renderHTML({ HTMLAttributes }: any) {
          if (HTMLAttributes.linktype === 'story') {
            // Return component reference as DOMOutputSpec tag
            return [RouterLink, { to: HTMLAttributes.href }, 0];
          }
          return ['a', { href: HTMLAttributes.href }, 0];
        },
      });

      const { render } = richTextResolver<VNode>({
        renderFn: h,
        textFn: createTextVNode,
        tiptapExtensions: { link: CustomLink },
      });

      // Story link → should use RouterLink component
      const storyLink = {
        type: 'text',
        text: 'Internal Link',
        marks: [{
          type: 'link',
          attrs: { href: '/about', linktype: 'story' },
        }],
      };
      const storyVNode = render(storyLink as any);
      expect(storyVNode.__v_isVNode).toBeTruthy();
      expect(storyVNode.type).toBe(RouterLink);
      expect(storyVNode.props?.to).toBe('/about');

      // URL link → should use <a> tag
      const urlLink = {
        type: 'text',
        text: 'External Link',
        marks: [{
          type: 'link',
          attrs: { href: 'https://example.com', linktype: 'url' },
        }],
      };
      const urlVNode = render(urlLink as any);
      expect(urlVNode.__v_isVNode).toBeTruthy();
      expect(urlVNode.type).toBe('a');
      expect(urlVNode.props?.href).toBe('https://example.com');
    });

    it('should render a node with a Vue component via tiptapExtensions', () => {
      const CustomAlert = { name: 'CustomAlert', render: () => null };

      const AlertNode = Node.create({
        name: 'paragraph',
        content: 'inline*',
        group: 'block',
        renderHTML() {
          return [CustomAlert, { class: 'alert' }, 0];
        },
      });

      const { render } = richTextResolver<VNode>({
        renderFn: h,
        textFn: createTextVNode,
        tiptapExtensions: { paragraph: AlertNode },
      });

      const doc = {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Alert content' }],
      };
      const vnode = render(doc as any);
      expect(vnode.__v_isVNode).toBeTruthy();
      expect(vnode.type).toBe(CustomAlert);
      expect(vnode.props?.class).toBe('alert');
    });
  });
});

describe('text Alignment', () => {
  it('should render paragraph with text alignment', async () => {
    const { render } = richTextResolver();
    const node = {
      type: 'paragraph',
      attrs: {
        textAlign: 'right',
      },
      content: [
        {
          type: 'text',
          text: 'Right aligned text',
        },
      ],
    };

    const html = render(node as StoryblokRichTextNode<string>);
    expect(html).toBe('<p style="text-align: right;">Right aligned text</p>');
  });

  it('should handle multiple paragraphs with different alignments', async () => {
    const { render } = richTextResolver();
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: {
            textAlign: 'right',
          },
          content: [
            {
              type: 'text',
              text: 'Right aligned text',
            },
          ],
        },
        {
          type: 'paragraph',
          attrs: {
            textAlign: 'center',
          },
          content: [
            {
              type: 'text',
              text: 'Center aligned text',
            },
          ],
        },
        {
          type: 'paragraph',
          attrs: {
            textAlign: 'left',
          },
          content: [
            {
              type: 'text',
              text: 'Left aligned text',
            },
          ],
        },
      ],
    };

    const html = render(doc as StoryblokRichTextNode<string>);
    expect(html).toBe(
      '<p style="text-align: right;">Right aligned text</p>'
      + '<p style="text-align: center;">Center aligned text</p>'
      + '<p style="text-align: left;">Left aligned text</p>',
    );
  });

  it('should handle text alignment with other attributes', async () => {
    const { render } = richTextResolver();
    const node = {
      type: 'paragraph',
      attrs: {
        textAlign: 'right',
        class: 'custom-class',
        id: 'custom-id',
      },
      content: [
        {
          type: 'text',
          text: 'Styled text',
        },
      ],
    };

    const html = render(node as StoryblokRichTextNode<string>);
    expect(html).toBe('<p class="custom-class" id="custom-id" style="text-align: right;">Styled text</p>');
  });

  it('should preserve existing style attributes when adding text alignment', async () => {
    const { render } = richTextResolver();
    const node = {
      type: 'paragraph',
      attrs: {
        textAlign: 'right',
        style: 'color: red;',
      },
      content: [
        {
          type: 'text',
          text: 'Colored and aligned text',
        },
      ],
    };

    const html = render(node as StoryblokRichTextNode<string>);
    expect(html).toBe('<p style="color: red; text-align: right;">Colored and aligned text</p>');
  });

  it('should handle text alignment in headings', async () => {
    const { render } = richTextResolver();
    const node = {
      type: 'heading',
      attrs: {
        level: 2,
        textAlign: 'center',
      },
      content: [
        {
          type: 'text',
          text: 'Centered Heading',
        },
      ],
    };

    const html = render(node as StoryblokRichTextNode<string>);
    expect(html).toBe('<h2 style="text-align: center;">Centered Heading</h2>');
  });

  it('should handle text alignment in list items', async () => {
    const { render } = richTextResolver();
    const node = {
      type: 'bullet_list',
      content: [
        {
          type: 'list_item',
          attrs: {
            textAlign: 'right',
          },
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'Right aligned list item',
                },
              ],
            },
          ],
        },
      ],
    };

    const html = render(node as StoryblokRichTextNode<string>);
    expect(html).toBe('<ul><li style="text-align: right;"><p>Right aligned list item</p></li></ul>');
  });

  it('should handle text alignment in table cells', async () => {
    const { render } = richTextResolver();
    const node = {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              attrs: {
                textAlign: 'center',
              },
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: 'Centered cell',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const html = render(node as StoryblokRichTextNode<string>);
    expect(html).toBe('<table><tbody><tr><td style="text-align: center;"><p>Centered cell</p></td></tr></tbody></table>');
  });

  it('should handle text alignment with multiple styles in table cells', async () => {
    const { render } = richTextResolver();
    const node = {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              attrs: {
                textAlign: 'center',
                backgroundColor: '#F5F5F5',
                colwidth: 200,
              },
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: 'Styled cell',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const html = render(node as StoryblokRichTextNode<string>);
    expect(html).toBe('<table><tbody><tr><td style="width: 200px; background-color: #F5F5F5; text-align: center;"><p>Styled cell</p></td></tr></tbody></table>');
  });

  it('should handle empty paragraphs with text alignment', async () => {
    const { render } = richTextResolver();
    const node = {
      type: 'paragraph',
      attrs: {
        textAlign: 'center',
      },
      content: [],
    };

    const html = render(node as StoryblokRichTextNode<string>);
    expect(html).toBe('<p style="text-align: center;"></p>');
  });

  it('should handle text alignment with mixed content', async () => {
    const { render } = richTextResolver();
    const node = {
      type: 'paragraph',
      attrs: {
        textAlign: 'right',
      },
      content: [
        {
          type: 'text',
          text: 'Text with ',
        },
        {
          type: 'text',
          text: 'bold',
          marks: [{ type: 'bold' }],
        },
        {
          type: 'text',
          text: ' and ',
        },
        {
          type: 'text',
          text: 'link',
          marks: [{ type: 'link', attrs: { href: '#' } }],
        },
      ],
    };

    const html = render(node as StoryblokRichTextNode<string>);
    expect(html).toBe('<p style="text-align: right;">Text with <strong>bold</strong> and <a href="#">link</a></p>');
  });
});

describe('tiptapExtensions', () => {
  it('should allow overriding a built-in node extension', () => {
    const CustomHeading = Heading.extend({
      renderHTML({ HTMLAttributes }) {
        const { level, ...rest } = HTMLAttributes;
        return [`h${level}`, { class: `custom-heading-${level}`, ...rest }, 0];
      },
    });

    const doc = {
      type: 'doc',
      content: [{
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Hello' }],
      }],
    };

    const html = richTextResolver<string>({
      tiptapExtensions: { heading: CustomHeading },
    }).render(doc as any);

    expect(html).toBe('<h2 class="custom-heading-2">Hello</h2>');
  });

  it('should allow overriding a built-in mark extension', () => {
    const CustomBold = Bold.extend({
      renderHTML() {
        return ['b', { class: 'custom-bold' }, 0];
      },
    });

    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{
          type: 'text',
          text: 'Bold text',
          marks: [{ type: 'bold' }],
        }],
      }],
    };

    const html = richTextResolver<string>({
      tiptapExtensions: { bold: CustomBold },
    }).render(doc as any);

    expect(html).toBe('<p><b class="custom-bold">Bold text</b></p>');
  });

  it('should allow adding a custom node extension', () => {
    const Callout = Node.create({
      name: 'callout',
      group: 'block',
      content: 'inline*',
      renderHTML({ HTMLAttributes }) {
        return ['div', { 'data-callout': '', 'class': 'callout', ...HTMLAttributes }, 0];
      },
    });

    const doc = {
      type: 'doc',
      content: [{
        type: 'callout',
        content: [{ type: 'text', text: 'Important note' }],
      }],
    };

    const html = richTextResolver<string>({
      tiptapExtensions: { callout: Callout },
    }).render(doc as any);

    expect(html).toBe('<div data-callout="" class="callout">Important note</div>');
  });

  it('should allow adding a custom mark extension', () => {
    const Spoiler = Mark.create({
      name: 'spoiler',
      renderHTML() {
        return ['span', { class: 'spoiler' }, 0];
      },
    });

    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{
          type: 'text',
          text: 'Secret',
          marks: [{ type: 'spoiler' }],
        }],
      }],
    };

    const html = richTextResolver<string>({
      tiptapExtensions: { spoiler: Spoiler },
    }).render(doc as any);

    expect(html).toBe('<p><span class="spoiler">Secret</span></p>');
  });
});

describe('renderComponent (blok extension option)', () => {
  const blokDoc = {
    type: 'doc',
    content: [{
      type: 'blok',
      attrs: {
        id: '489f2970-6787-486a-97c3-6f1e8a99b7a9',
        body: [
          {
            _uid: 'i-134324ee-1754-48be-93df-02df1e394733',
            title: 'Second button!',
            component: 'test-button',
          },
          {
            _uid: 'i-437c2948-0be9-442e-949d-a11c79736aa6',
            title: 'My Button',
            component: 'test-button',
          },
        ],
      },
    }],
  };

  describe('vanilla (HTML string)', () => {
    it('should render blok nodes via renderComponent returning HTML strings', () => {
      const { render } = richTextResolver<string>({
        tiptapExtensions: {
          blok: ComponentBlok.configure({
            renderComponent: (blok: any, id?: string) =>
              `<div data-component="${blok.component}" data-id="${id}">${blok.title}</div>`,
          }),
        },
      });

      const html = render(blokDoc as any);
      expect(html).toBe(
        '<div data-component="test-button" data-id="489f2970-6787-486a-97c3-6f1e8a99b7a9">Second button!</div>'
        + '<div data-component="test-button" data-id="489f2970-6787-486a-97c3-6f1e8a99b7a9">My Button</div>',
      );
    });

    it('should return empty string for empty body', () => {
      const { render } = richTextResolver<string>({
        tiptapExtensions: {
          blok: ComponentBlok.configure({
            renderComponent: (blok: any) => `<div>${blok.title}</div>`,
          }),
        },
      });

      const doc = {
        type: 'doc',
        content: [{
          type: 'blok',
          attrs: { id: 'test', body: [] },
        }],
      };
      const html = render(doc as any);
      expect(html).toBe('');
    });

    it('should return empty string when body is undefined', () => {
      const { render } = richTextResolver<string>({
        tiptapExtensions: {
          blok: ComponentBlok.configure({
            renderComponent: (blok: any) => `<div>${blok.title}</div>`,
          }),
        },
      });

      const doc = {
        type: 'doc',
        content: [{
          type: 'blok',
          attrs: { id: 'test' },
        }],
      };
      const html = render(doc as any);
      expect(html).toBe('');
    });
  });

  describe('framework (Vue VNodes)', () => {
    it('should render blok nodes via renderComponent returning VNodes', () => {
      const MockComponent = { name: 'MockBlok', render: () => null };

      const { render } = richTextResolver<VNode | VNode[]>({
        renderFn: h,
        // @ts-expect-error - createTextVNode types
        textFn: createTextVNode,
        keyedResolvers: true,
        tiptapExtensions: {
          blok: ComponentBlok.configure({
            renderComponent: (blok: any, id?: string) =>
              h(MockComponent, { blok, id }),
          }),
        },
      });

      const result = render(blokDoc as any) as any;
      // doc renders array of children; first child is the blok array
      const blokElements = result[0];
      expect(Array.isArray(blokElements)).toBe(true);
      expect(blokElements).toHaveLength(2);
      expect(blokElements[0].props.blok.component).toBe('test-button');
      expect(blokElements[0].props.blok.title).toBe('Second button!');
      expect(blokElements[1].props.blok.component).toBe('test-button');
      expect(blokElements[1].props.blok.title).toBe('My Button');
    });

    it('should return empty array for empty body in framework mode', () => {
      const { render } = richTextResolver<VNode | VNode[]>({
        renderFn: h,
        // @ts-expect-error - createTextVNode types
        textFn: createTextVNode,
        tiptapExtensions: {
          blok: ComponentBlok.configure({
            renderComponent: (blok: any) => h('div', {}, blok.title),
          }),
        },
      });

      const doc = {
        type: 'doc',
        content: [{
          type: 'blok',
          attrs: { id: 'test', body: [] },
        }],
      };
      const result = render(doc as any) as any;
      expect(result[0]).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should render two consecutive blok nodes in sequence', () => {
      const { render } = richTextResolver<string>({
        tiptapExtensions: {
          blok: ComponentBlok.configure({
            renderComponent: (blok: any, id?: string) =>
              `<div data-component="${blok.component}" data-id="${id}">${blok.title}</div>`,
          }),
        },
      });

      const doc = {
        type: 'doc',
        content: [
          {
            type: 'blok',
            attrs: {
              id: 'blok-1',
              body: [{ _uid: '1', component: 'banner', title: 'Banner A' }],
            },
          },
          {
            type: 'blok',
            attrs: {
              id: 'blok-2',
              body: [{ _uid: '2', component: 'cta', title: 'CTA B' }],
            },
          },
        ],
      };
      const html = render(doc as any);
      expect(html).toBe(
        '<div data-component="banner" data-id="blok-1">Banner A</div>'
        + '<div data-component="cta" data-id="blok-2">CTA B</div>',
      );
    });

    it('should render a single body item', () => {
      const { render } = richTextResolver<string>({
        tiptapExtensions: {
          blok: ComponentBlok.configure({
            renderComponent: (blok: any) => `<button>${blok.title}</button>`,
          }),
        },
      });

      const doc = {
        type: 'doc',
        content: [{
          type: 'blok',
          attrs: {
            id: 'single',
            body: [{ _uid: '1', component: 'btn', title: 'Solo' }],
          },
        }],
      };
      const html = render(doc as any);
      expect(html).toBe('<button>Solo</button>');
    });

    it('should return empty string when body is null', () => {
      const { render } = richTextResolver<string>({
        tiptapExtensions: {
          blok: ComponentBlok.configure({
            renderComponent: (blok: any) => `<div>${blok.title}</div>`,
          }),
        },
      });

      const doc = {
        type: 'doc',
        content: [{
          type: 'blok',
          attrs: { id: 'test', body: null },
        }],
      };
      const html = render(doc as any);
      expect(html).toBe('');
    });

    it('should produce empty string when renderComponent callback returns null', () => {
      const { render } = richTextResolver<string>({
        tiptapExtensions: {
          blok: ComponentBlok.configure({
            renderComponent: () => null,
          }),
        },
      });

      const doc = {
        type: 'doc',
        content: [{
          type: 'blok',
          attrs: {
            id: 'test',
            body: [{ _uid: '1', component: 'hidden', title: 'Hidden' }],
          },
        }],
      };
      const html = render(doc as any);
      expect(html).toBe('');
    });

    it('should fall back to renderHTML warning when no renderComponent is configured', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { render } = richTextResolver<string>({});

      const doc = {
        type: 'doc',
        content: [{
          type: 'blok',
          attrs: {
            id: 'test',
            body: [{ _uid: '1', component: 'btn', title: 'Click' }],
          },
        }],
      };
      const html = render(doc as any);
      expect(html).toContain('display: none');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('BLOK resolver is not available'),
      );
      warnSpy.mockRestore();
    });

    it('should support heading override and blok renderComponent together', () => {
      const CustomHeading = Heading.extend({
        renderHTML({ HTMLAttributes }) {
          const { level, ...rest } = HTMLAttributes;
          return [`h${level}`, { class: 'custom', ...rest }, 0];
        },
      });

      const { render } = richTextResolver<string>({
        tiptapExtensions: {
          heading: CustomHeading,
          blok: ComponentBlok.configure({
            renderComponent: (blok: any) => `<widget>${blok.title}</widget>`,
          }),
        },
      });

      const doc = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Title' }],
          },
          {
            type: 'blok',
            attrs: {
              id: 'b1',
              body: [{ _uid: '1', component: 'widget', title: 'My Widget' }],
            },
          },
        ],
      };
      const html = render(doc as any);
      expect(html).toBe('<h2 class="custom">Title</h2><widget>My Widget</widget>');
    });

    it('should allow user to override the default blok extension entirely', () => {
      const CustomBlok = Node.create({
        name: 'blok',
        group: 'block',
        atom: true,
        renderHTML({ HTMLAttributes }) {
          return ['div', { 'class': 'custom-blok', 'data-id': HTMLAttributes.id }];
        },
      });

      const { render } = richTextResolver<string>({
        tiptapExtensions: { blok: CustomBlok },
      });

      const doc = {
        type: 'doc',
        content: [{
          type: 'blok',
          attrs: { id: 'test', body: [{ _uid: '1', component: 'x' }] },
        }],
      };
      const html = render(doc as any);
      expect(html).toBe('<div class="custom-blok" data-id="test"></div>');
    });

    it('should not apply keyed resolvers to blok renderComponent output', () => {
      const { render } = richTextResolver<string>({
        keyedResolvers: true,
        tiptapExtensions: {
          blok: ComponentBlok.configure({
            renderComponent: (blok: any) => `<button>${blok.title}</button>`,
          }),
        },
      });

      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Before' }],
          },
          {
            type: 'blok',
            attrs: {
              id: 'b1',
              body: [{ _uid: '1', component: 'btn', title: 'Click' }],
            },
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'After' }],
          },
        ],
      };
      const html = render(doc as any);
      // Blok output is raw (no key attrs), but surrounding paragraphs get keys
      expect(html).toBe('<p key="p-0">Before</p><button>Click</button><p key="p-1">After</p>');
    });
  });

  describe('mixed content', () => {
    it('should work alongside other content in a document', () => {
      const { render } = richTextResolver<string>({
        tiptapExtensions: {
          blok: ComponentBlok.configure({
            renderComponent: (blok: any) =>
              `<button>${blok.title}</button>`,
          }),
        },
      });

      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Before blok' }],
          },
          {
            type: 'blok',
            attrs: {
              id: 'test',
              body: [{ _uid: '1', component: 'btn', title: 'Click me' }],
            },
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'After blok' }],
          },
        ],
      };
      const html = render(doc as any);
      expect(html).toBe('<p>Before blok</p><button>Click me</button><p>After blok</p>');
    });
  });

  it('should register all expected extensions', () => {
    const extensions = getStoryblokExtensions();
    const extensionValues = Object.values(extensions);

    const nodeNames = extensionValues.filter(e => e.type === 'node').map(e => e.name).sort();
    const markNames = extensionValues.filter(e => e.type === 'mark').map(e => e.name).sort();

    expect(nodeNames).toEqual([
      'blockquote',
      'blok',
      'bullet_list',
      'code_block',
      'details',
      'detailsContent',
      'detailsSummary',
      'doc',
      'emoji',
      'hard_break',
      'heading',
      'horizontal_rule',
      'image',
      'list_item',
      'ordered_list',
      'paragraph',
      'table',
      'tableCell',
      'tableHeader',
      'tableRow',
      'text',
    ].sort());

    expect(markNames).toEqual([
      'anchor',
      'bold',
      'code',
      'highlight',
      'italic',
      'link',
      'reporter',
      'strike',
      'styled',
      'subscript',
      'superscript',
      'textStyle',
      'underline',
    ].sort());
  });
});
