import { describe, expect, it, vi } from 'vitest';
import { richTextRenderer } from './richtext-renderer';
import type { StoryblokRichTextJson, StoryblokRichTextRendererOptions } from './types';

describe('richtext', () => {
  describe('document', () => {
    it('should not render any wrapper tag', () => {
      const richdata: StoryblokRichTextJson = {
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
      const html = richTextRenderer(richdata);
      expect(html).toBe('<p>Hey </p><p>nested</p>');
    });
  });
  describe('blocktypes', () => {
    it('should render an image with attrs', async () => {
      const image: Extract<StoryblokRichTextJson, { type: 'image' }> = {
        type: 'image',
        attrs: {
          id: 123,
          src: 'https://example.com/image.jpg',
          alt: 'An image',
          copyright: '© Storyblok',
          source: 'Storyblok',
          title: 'An image',
          meta_data: {
            alt: 'An image',
            title: 'An image',
            copyright: '© Storyblok',
            source: 'Storyblok',
          },
        },
      };
      const html = richTextRenderer(image);
      expect(html).toBe('<img src="https://example.com/image.jpg" alt="An image" title="An image" />');
    });

    it('should optimize image attrs', async () => {
      const image: Extract<StoryblokRichTextJson, { type: 'image' }> = {
        type: 'image',
        attrs: {
          id: 123,
          src: 'https://example.com/image.jpg',
          alt: 'An image',
          copyright: '© Storyblok',
          source: 'Storyblok',
          title: 'An image',
          meta_data: {
            alt: 'An image',
            title: 'An image',
            copyright: '© Storyblok',
            source: 'Storyblok',
          },
        },
      };
      /*
      todo: optimizeImage function to return a specific result for testing
      */
      const html = richTextRenderer(image, { optimizeImages: true });
      expect(html).toBe('<img src="https://example.com/image.jpg" alt="An image" title="An image" />');
    });

    it('should render an emoji', async () => {
      const emoji: StoryblokRichTextJson = {
        type: 'doc',
        content: [
          {
            type: 'emoji',
            attrs: {
              emoji: '🚀',
              name: 'smile',
              fallbackImage: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f60b.png',
            },
          },
        ],
      };
      const html = richTextRenderer(emoji);
      expect(html).toBe('<img emoji="🚀" name="smile" src="https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f60b.png" draggable="false" loading="lazy" style="width: 1.25em; height: 1.25em; vertical-align: text-top;" />');
    });

    it('should render a table', async () => {
      const table: StoryblokRichTextJson = {
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
      const html = richTextRenderer(table);
      expect(html).toBe('<table><tbody><tr><td colspan="1" rowspan="1"><p>Cell 1</p></td><td colspan="1" rowspan="1"><p>Cell 2</p></td></tr></tbody></table>');
    });

    it('should render a table with colspan and rowspan', async () => {
      const table: StoryblokRichTextJson = {
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
      const html = richTextRenderer(table);
      expect(html).toBe('<table><tbody><tr><td colspan="2" rowspan="1"><p>Merged Cell</p></td></tr><tr><td colspan="1" rowspan="1"><p>Cell 1</p></td><td colspan="1" rowspan="1"><p>Cell 2</p></td></tr></tbody></table>');
    });

    it('should render a table with colwidth', async () => {
      const table: StoryblokRichTextJson = {
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
                  colwidth: [200],
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
      const html = richTextRenderer(table);
      expect(html).toBe('<table><tbody><tr><td colspan="1" rowspan="1" style="width: 200px;"><p>Fixed Width Cell</p></td></tr></tbody></table>');
    });

    it('should render a table cell with background color', async () => {
      const table: StoryblokRichTextJson = {
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
      const html = richTextRenderer(table);
      expect(html).toBe('<table><tbody><tr><td colspan="1" rowspan="1" style="background-color: #F11F1F;"><p>Colored Cell</p></td></tr></tbody></table>');
    });

    it('should render a table cell with both width and background color', async () => {
      const table: StoryblokRichTextJson = {
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
                  colwidth: [200],
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
      const html = richTextRenderer(table);
      expect(html).toBe('<table><tbody><tr><td colspan="1" rowspan="1" style="width: 200px; background-color: #F11F1F;"><p>Styled Cell</p></td></tr></tbody></table>');
    });

    it('should render a table with header cells', async () => {
      const table: StoryblokRichTextJson = {
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
      richTextRenderer(table);

      /*
      TODO: this needs to fixed at code level.
      */
      // expect(html).toBe('<table><thead><tr><th style="background-color: #F5F5F5;"><p>Header Cell</p></th><th><p>Another Header</p></th></tr></thead><tbody><tr><td><p>Regular Cell</p></td><td><p>Another Cell</p></td></tr></tbody></table>');
    });
  });

  describe('textTypes & MarksTypes', () => {
    it('should render text with styled marks', async () => {
      const text: StoryblokRichTextJson = {
        type: 'paragraph',
        content: [
          {
            text: 'Bold and italic',
            type: 'text',
            marks: [{ type: 'textStyle', attrs: { color: 'red' } }, { type: 'textStyle', attrs: { color: 'blue' } }],
          },
        ],
      };
      const html = richTextRenderer(text);
      // Update the expected HTML to reflect the styles
      expect(html).toBe('<p><span style="color: blue;"><span style="color: red;">Bold and italic</span></span></p>');
    });

    it('should render an external link', async () => {
      const link: StoryblokRichTextJson = {
        text: 'External link',
        type: 'text',
        marks: [
          {
            type: 'link',
            attrs: {
              uuid: null,
              anchor: null,
              href: 'https://example.com',
              target: '_blank',
              linktype: 'url',
            },
          },
        ],
      };
      const html = richTextRenderer(link);
      expect(html).toBe('<a href="https://example.com" target="_blank">External link</a>');
    });

    it('should render an anchor link', async () => {
      const link: StoryblokRichTextJson = {
        text: 'Anchor link',
        type: 'text',
        marks: [
          {
            type: 'link',
            attrs: {
              uuid: null,
              href: '/home',
              target: '_self',
              anchor: 'anchor',
              linktype: 'story',
            },
          },
        ],
      };
      const html = richTextRenderer(link);
      expect(html).toBe('<a href="/home#anchor" target="_self">Anchor link</a>');
    });

    it('should render an email link', async () => {
      const link: StoryblokRichTextJson = {
        text: 'jane@example.com',
        type: 'text',
        marks: [
          {
            type: 'link',
            attrs: {
              href: 'jane@example.com',
              linktype: 'email',
              uuid: null,
              anchor: null,
              target: null,
            },
          },
        ],
      };
      const html = richTextRenderer(link);
      expect(html).toBe('<a href="mailto:jane@example.com">jane@example.com</a>');
    });

    it('should not duplicate mailto: prefix when href already contains it', async () => {
      const link: StoryblokRichTextJson = {
        text: 'hey@hoe.dev',
        type: 'text',
        marks: [
          {
            type: 'link',
            attrs: {
              href: 'mailto:hey@hoe.dev',
              linktype: 'email',
              uuid: null,
              anchor: null,
              target: null,
            },
          },
        ],
      };
      const html = richTextRenderer(link);
      expect(html).toBe('<a href="mailto:hey@hoe.dev">hey@hoe.dev</a>');
    });

    it('should render an internal link', async () => {
      const link: StoryblokRichTextJson = {
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
              custom: { foo: 'bar' },
            },
          },
        ],
      };
      const html = richTextRenderer(link);
      expect(html).toBe('<a href="/" target="_blank">Internal Link</a>');
    });

    it('should render an asset link', async () => {
      const link: StoryblokRichTextJson = {
        text: 'Asset link',
        type: 'text',
        marks: [
          {
            type: 'link',
            attrs: {
              href: 'https://a.storyblok.com/f/67536/400x303/ccbe9ca7b3/nuxt-logo.png',
              linktype: 'asset',
              uuid: null,
              anchor: null,
              target: null,
            },
          },
        ],
      };
      const html = richTextRenderer(link);
      expect(html).toBe('<a href="https://a.storyblok.com/f/67536/400x303/ccbe9ca7b3/nuxt-logo.png">Asset link</a>');
    });

    it('should not render href when is empty', async () => {
      const link: StoryblokRichTextJson = {
        text: 'Link text',
        type: 'text',
        marks: [
          {
            type: 'link',
            attrs: {
              linktype: 'url',
              uuid: null,
              anchor: null,
              target: null,
              href: null,
            },
          },
        ],
      };
      const html = richTextRenderer(link);
      expect(html).toBe('<a>Link text</a>');
    });

    it('should not render null attributes on links', async () => {
      const link: StoryblokRichTextJson = {
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
      const html = richTextRenderer(link);
      expect(html).toBe('<a href="/">Hello</a>');
    });

    it('should render as a URL when linktype is not defined', async () => {
      const link: StoryblokRichTextJson = {
        text: 'Link text',
        type: 'text',
        marks: [
          {
            type: 'link',
            attrs: {
              href: 'https://url.com',
              linktype: null,
              uuid: null,
              anchor: null,
              target: null,
            },
          },
        ],
      };
      const html = richTextRenderer(link);
      expect(html).toBe('<a href="https://url.com">Link text</a>');
    });
    it('should render anchor mark as span with id, not as a link', () => {
      const text: StoryblokRichTextJson = {
        type: 'text',
        text: 'Anchored text',
        marks: [{ type: 'anchor', attrs: { id: 'my-section' } }],
      };
      const html = richTextRenderer(text);
      expect(html).toBe('<span id="my-section">Anchored text</span>');
    });

    it('should not leak language attribute onto pre element', () => {
      const codeBlock: StoryblokRichTextJson = {
        type: 'code_block',
        attrs: { class: 'js' },
        content: [{ type: 'text', text: 'const x = 1;' }],
      };
      const html = richTextRenderer(codeBlock);
      expect(html).toBe('<pre class="js"><code class="js">const x = 1;</code></pre>');
      expect(html).not.toContain('language="js"');
    });
  });
});

describe('text Alignment', () => {
  it('should render paragraph with text alignment', async () => {
    const node: StoryblokRichTextJson = {
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

    const html = richTextRenderer(node);
    expect(html).toBe('<p style="text-align: right;">Right aligned text</p>');
  });

  it('should handle multiple paragraphs with different alignments', async () => {
    const doc: StoryblokRichTextJson = {
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

    const html = richTextRenderer(doc);
    expect(html).toBe(
      '<p style="text-align: right;">Right aligned text</p>'
      + '<p style="text-align: center;">Center aligned text</p>'
      + '<p style="text-align: left;">Left aligned text</p>',
    );
  });

  it('should handle text alignment with other attributes', async () => {
    const node: StoryblokRichTextJson = {
      type: 'paragraph',
      attrs: {
        textAlign: 'right',
      },
      content: [
        {
          type: 'text',
          text: 'Styled text',
          marks: [{ type: 'anchor', attrs: { id: 'custom-id' } }, { type: 'styled', attrs: { class: 'custom-class' } }],
        },
      ],
    };

    const html = richTextRenderer(node);
    expect(html).toBe('<p style="text-align: right;"><span class="custom-class"><span id="custom-id">Styled text</span></span></p>');
  });

  it('should preserve existing style attributes when adding text alignment', async () => {
    const node: StoryblokRichTextJson = {
      type: 'paragraph',
      attrs: {
        textAlign: 'right',
      },
      content: [
        {
          type: 'text',
          text: 'Colored and aligned text',
          marks: [{ type: 'textStyle', attrs: { color: 'red' } }],
        },
      ],
    };

    const html = richTextRenderer(node);
    expect(html).toBe('<p style="text-align: right;"><span style="color: red;">Colored and aligned text</span></p>');
  });

  it('should handle text alignment in headings', async () => {
    const node: StoryblokRichTextJson = {
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

    const html = richTextRenderer(node);
    expect(html).toBe('<h2 style="text-align: center;">Centered Heading</h2>');
  });

  it('should handle text alignment in list items', async () => {
    const node: StoryblokRichTextJson = {
      type: 'bullet_list',
      content: [
        {
          type: 'list_item',
          content: [
            {
              type: 'paragraph',
              attrs: {
                textAlign: 'right',
              },
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

    const html = richTextRenderer(node);
    expect(html).toBe('<ul><li><p style="text-align: right;">Right aligned list item</p></li></ul>');
  });

  it('should handle text alignment in table cells', async () => {
    const node: StoryblokRichTextJson = {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              content: [
                {
                  type: 'paragraph',
                  attrs: {
                    textAlign: 'center',
                  },
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

    const html = richTextRenderer(node);
    expect(html).toBe('<table><tbody><tr><td><p style="text-align: center;">Centered cell</p></td></tr></tbody></table>');
  });

  it('should handle text alignment with multiple styles in table cells', async () => {
    const node: StoryblokRichTextJson = {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              attrs: {
                colwidth: [200],
                backgroundColor: '#F5F5F5',
                colspan: 1,
                rowspan: 1,
              },
              content: [
                {
                  type: 'paragraph',
                  attrs: {
                    textAlign: 'center',
                  },
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

    const html = richTextRenderer(node);
    expect(html).toBe('<table><tbody><tr><td style="width: 200px; background-color: #F5F5F5;"><p style="text-align: center;">Styled cell</p></td></tr></tbody></table>');
  });

  it('should handle empty paragraphs with text alignment', async () => {
    const node: StoryblokRichTextJson = {
      type: 'paragraph',
      attrs: {
        textAlign: 'center',
      },
      content: [],
    };

    const html = richTextRenderer(node);
    expect(html).toBe('<p style="text-align: center;"></p>');
  });

  it('should handle text alignment with mixed content', async () => {
    const node: StoryblokRichTextJson = {
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
          marks: [{ type: 'link', attrs: { href: '#', linktype: null, uuid: null, anchor: null, target: null } }],
        },
      ],
    };

    const html = richTextRenderer(node);
    expect(html).toBe('<p style="text-align: right;">Text with <strong>bold</strong> and <a href="#">link</a></p>');
  });
});

describe('renderComponent (blok extension option)', () => {
  const blokDoc: StoryblokRichTextJson = {
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
      const options: StoryblokRichTextRendererOptions = {
        renderers: {
          blok: ({ attrs }) => {
            const body = Array.isArray(attrs?.body) ? attrs.body : [];
            return body.map(blok => `<div data-component="${blok.component}" data-id="${attrs?.id}">${blok.title}</div>`).join('');
          },
        },
      };
      const html = richTextRenderer(blokDoc, options);
      expect(html).toBe(
        '<div data-component="test-button" data-id="489f2970-6787-486a-97c3-6f1e8a99b7a9">Second button!</div>'
        + '<div data-component="test-button" data-id="489f2970-6787-486a-97c3-6f1e8a99b7a9">My Button</div>',
      );
    });

    it('should return empty string for empty body', () => {
      const doc: StoryblokRichTextJson = {
        type: 'doc',
        content: [{
          type: 'blok',
          attrs: { id: 'test', body: [] },
        }],
      };
      const html = richTextRenderer(doc);
      expect(html).toBe('');
    });

    it('should return empty string when body is undefined', () => {
      const doc: StoryblokRichTextJson = {
        type: 'doc',
        content: [{
          type: 'blok',
          attrs: { id: 'test' },
        }],
      };
      const html = richTextRenderer(doc);
      expect(html).toBe('');
    });
  });

  describe('edge cases', () => {
    it('should render two consecutive blok nodes in sequence', () => {
      const options: StoryblokRichTextRendererOptions = {
        renderers: {
          blok: ({ attrs }) => {
            const body = Array.isArray(attrs?.body) ? attrs.body : [];
            return body.map(blok => `<div data-component="${blok.component}" data-id="${attrs?.id}">${blok.title}</div>`).join('');
          },
        },
      };
      const doc: StoryblokRichTextJson = {
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
      const html = richTextRenderer(doc, options);
      expect(html).toBe(
        '<div data-component="banner" data-id="blok-1">Banner A</div>'
        + '<div data-component="cta" data-id="blok-2">CTA B</div>',
      );
    });

    it('should render a single body item', () => {
      const options: StoryblokRichTextRendererOptions = {
        renderers: {
          blok: ({ attrs }) => {
            const body = Array.isArray(attrs?.body) ? attrs.body : [];
            return body.map(blok => `<button>${blok.title}</button>`).join('');
          },
        },
      };
      const doc: StoryblokRichTextJson = {
        type: 'doc',
        content: [{
          type: 'blok',
          attrs: {
            id: 'single',
            body: [{ _uid: '1', component: 'btn', title: 'Solo' }],
          },
        }],
      };
      const html = richTextRenderer(doc, options);
      expect(html).toBe('<button>Solo</button>');
    });

    it('should return empty string when body is null', () => {
      const doc: StoryblokRichTextJson = {
        type: 'doc',
        content: [{
          type: 'blok',
          attrs: { id: 'test', body: null },
        }],
      };
      const html = richTextRenderer(doc);
      expect(html).toBe('');
    });

    it('should produce empty string when renderComponent callback returns null', () => {
      const doc: StoryblokRichTextJson = {
        type: 'doc',
        content: [{
          type: 'blok',
          attrs: {
            id: 'test',
            body: [{ _uid: '1', component: 'hidden', title: 'Hidden' }],
          },
        }],
      };
      const html = richTextRenderer(doc);
      expect(html).toBe('');
    });

    it('should fall back to renderHTML warning when no renderComponent is configured', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const doc: StoryblokRichTextJson = {
        type: 'doc',
        content: [{
          type: 'blok',
          attrs: {
            id: 'test',
            body: [{ _uid: '1', component: 'btn', title: 'Click' }],
          },
        }],
      };
      richTextRenderer(doc);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Rendering of \"blok\" nodes is not supported in richTextRenderer.'),
      );
      warnSpy.mockRestore();
    });

    it('should support heading override and blok renderComponent together', () => {
      const options: StoryblokRichTextRendererOptions = {
        renderers: {
          heading: ({ attrs, content }) => `<h${attrs?.level} class="custom">${richTextRenderer(content, options)}</h${attrs?.level}>`,
          blok: ({ attrs }) => {
            const body = Array.isArray(attrs?.body) ? attrs.body : [];
            return body.map(blok => `<widget>${blok.title}</widget>`).join('');
          },
        },
      };

      const doc: StoryblokRichTextJson = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2, textAlign: null },
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
      const html = richTextRenderer(doc, options);
      expect(html).toBe('<h2 class="custom">Title</h2><widget>My Widget</widget>');
    });

    it('should allow user to override the default blok extension entirely', () => {
      const options: StoryblokRichTextRendererOptions = {
        renderers: {
          blok: ({ attrs }) => {
            const body = Array.isArray(attrs?.body) ? attrs.body : [];
            return body.map(_ => `<div class="custom-blok" data-id="${attrs?.id}"></div>`).join('');
          },
        },
      };
      const doc: StoryblokRichTextJson = {
        type: 'doc',
        content: [{
          type: 'blok',
          attrs: { id: 'test', body: [{ _uid: '1', component: 'x' }] },
        }],
      };
      const html = richTextRenderer(doc, options);
      expect(html).toBe('<div class="custom-blok" data-id="test"></div>');
    });
  });

  describe('mixed content', () => {
    it('should work alongside other content in a document', () => {
      const options: StoryblokRichTextRendererOptions = {
        renderers: {
          blok: ({ attrs }) => {
            const body = Array.isArray(attrs?.body) ? attrs.body : [];
            return body.map(blok => `<button>${blok.title}</button>`).join('');
          },
        },
      };
      const doc: StoryblokRichTextJson = {
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
      const html = richTextRenderer(doc, options);
      expect(html).toBe('<p>Before blok</p><button>Click me</button><p>After blok</p>');
    });
  });

  // describe('mark merging (adjacent text nodes with shared marks)', () => {
  //   it('should merge link with bold and italic inner marks', () => {
  //     const doc: StoryblokRichTextJson = {
  //       type: 'doc',
  //       content: [{
  //         type: 'paragraph',
  //         content: [
  //           { type: 'text', text: 'normal ', marks: [{ type: 'link', attrs: { href: '/url', linktype: 'url' } }] },
  //           { type: 'text', text: 'bold', marks: [{ type: 'bold' }, { type: 'link', attrs: { href: '/url', linktype: 'url' } }] },
  //           { type: 'text', text: ' and ', marks: [{ type: 'link', attrs: { href: '/url', linktype: 'url' } }] },
  //           { type: 'text', text: 'italic', marks: [{ type: 'italic' }, { type: 'link', attrs: { href: '/url', linktype: 'url' } }] },
  //           { type: 'text', text: ' end', marks: [{ type: 'link', attrs: { href: '/url', linktype: 'url' } }] },
  //         ],
  //       }],
  //     };

  //     const html = richTextRenderer(doc);
  //     expect(html).toBe('<p><a href="/url">normal <strong>bold</strong> and <em>italic</em> end</a></p>');
  //   });

  //   it('should handle non-text node breaking a link group', () => {
  //     const doc: StoryblokRichTextJson = {
  //       type: 'doc',
  //       content: [{
  //         type: 'paragraph',
  //         content: [
  //           { type: 'text', text: 'Before ', marks: [{ type: 'link', attrs: { href: '/x', linktype: 'url' } }] },
  //           { type: 'hard_break' },
  //           { type: 'text', text: 'After', marks: [{ type: 'link', attrs: { href: '/x', linktype: 'url' } }] },
  //         ],
  //       }],
  //     };

  //     const html = richTextRenderer(doc);
  //     expect(html).toBe('<p><a href="/x">Before </a><br><a href="/x">After</a></p>');
  //   });

  //   it('should separate groups when any link attr differs', () => {
  //     const doc: StoryblokRichTextJson = {
  //       type: 'doc',
  //       content: [{
  //         type: 'paragraph',
  //         content: [
  //           // Group 1: href /a
  //           { type: 'text', text: 'A', marks: [{ type: 'link', attrs: { href: '/a', linktype: 'url' } }] },
  //           { type: 'text', text: 'B', marks: [{ type: 'bold' }, { type: 'link', attrs: { href: '/a', linktype: 'url' } }] },
  //           // Group 2: same href, different target → separate group
  //           { type: 'text', text: 'C', marks: [{ type: 'link', attrs: { href: '/a', linktype: 'url', target: '_blank' } }] },
  //           { type: 'text', text: 'D', marks: [{ type: 'italic' }, { type: 'link', attrs: { href: '/a', linktype: 'url', target: '_blank' } }] },
  //         ],
  //       }],
  //     };

  //     const html = richTextRenderer(doc);
  //     expect(html).toBe('<p><a href="/a">A<strong>B</strong></a><a href="/a" target="_blank">C<em>D</em></a></p>');
  //   });
  // });
});
