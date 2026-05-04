import { describe, expect, it, vi } from 'vitest';
import { richTextRenderer } from './richtext-renderer';
import type { SbRichTextDoc, SbRichTextOptions } from './types';

// ============================================================================
// Test Helpers
// ============================================================================

/** Creates a text node. */
const text = (content: string, marks?: SbRichTextDoc['marks']): SbRichTextDoc => ({
  type: 'text',
  text: content,
  ...(marks && { marks }),
});

/** Creates a link mark. */
const linkMark = (
  href: string,
  options: { target?: '_blank' | '_self'; linktype?: 'url' | 'story' | 'email' | 'asset'; anchor?: string } = {},
): NonNullable<SbRichTextDoc['marks']>[number] => ({
  type: 'link',
  attrs: {
    href,
    linktype: options.linktype ?? 'url',
    target: options.target ?? null,
    anchor: options.anchor ?? null,
    uuid: null,
  },
});

/** Creates a table cell. */
const tableCell = (
  content: string,
  attrs: { colspan?: number; rowspan?: number; colwidth?: number[]; backgroundColor?: string } = {},
): SbRichTextDoc => ({
  type: 'tableCell',
  content: [{ type: 'paragraph', content: [text(content)] }],
  attrs: {
    colspan: attrs.colspan ?? 1,
    rowspan: attrs.rowspan ?? 1,
    ...(attrs.colwidth && { colwidth: attrs.colwidth }),
    ...(attrs.backgroundColor && { backgroundColor: attrs.backgroundColor }),
  },
});

/** Creates a table header cell. */
const tableHeader = (content: string): SbRichTextDoc => ({
  type: 'tableHeader',
  content: [{ type: 'paragraph', content: [text(content)] }],
  attrs: { colspan: 1, rowspan: 1 },
});

/** Creates a table row. */
const tableRow = (cells: SbRichTextDoc[]): SbRichTextDoc => ({
  type: 'tableRow',
  content: cells,
});

/** Creates a table. */
const table = (rows: SbRichTextDoc[]): SbRichTextDoc => ({
  type: 'table',
  content: rows,
});

// ============================================================================
// Tests: Input Handling
// ============================================================================

describe('richTextRenderer', () => {
  describe('input handling', () => {
    it('returns empty string for null input', () => {
      expect(richTextRenderer(null)).toBe('');
    });

    it('returns empty string for undefined input', () => {
      expect(richTextRenderer(undefined)).toBe('');
    });

    it('returns empty string for empty array', () => {
      expect(richTextRenderer([])).toBe('');
    });

    it('renders array of nodes', () => {
      const nodes: SbRichTextDoc[] = [
        { type: 'paragraph', content: [text('First')] },
        { type: 'paragraph', content: [text('Second')] },
      ];
      expect(richTextRenderer(nodes)).toBe('<p>First</p><p>Second</p>');
    });

    it('renders doc node without wrapper', () => {
      const doc: SbRichTextDoc = {
        type: 'doc',
        content: [{ type: 'paragraph', content: [text('Hello')] }],
      };
      expect(richTextRenderer(doc)).toBe('<p>Hello</p>');
    });

    it('renders nested doc nodes', () => {
      const nested: SbRichTextDoc = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [text('Outer')] },
          { type: 'doc', content: [{ type: 'paragraph', content: [text('Inner')] }] },
        ],
      };
      expect(richTextRenderer(nested)).toBe('<p>Outer</p><p>Inner</p>');
    });

    it('renders single non-doc node directly', () => {
      const node: SbRichTextDoc = { type: 'paragraph', content: [text('Direct')] };
      expect(richTextRenderer(node)).toBe('<p>Direct</p>');
    });
  });

  // ============================================================================
  // Tests: Block Types
  // ============================================================================

  describe('block types', () => {
    describe('paragraph', () => {
      it('renders basic paragraph', () => {
        const node: SbRichTextDoc = { type: 'paragraph', content: [text('Hello')] };
        expect(richTextRenderer(node)).toBe('<p>Hello</p>');
      });

      it('renders empty paragraph', () => {
        const node: SbRichTextDoc = { type: 'paragraph', content: [] };
        expect(richTextRenderer(node)).toBe('<p></p>');
      });
    });

    describe('heading', () => {
      it.each([1, 2, 3, 4, 5, 6] as const)('renders h%i', (level) => {
        const heading: SbRichTextDoc = {
          type: 'heading',
          attrs: { level, textAlign: null },
          content: [text(`Heading ${level}`)],
        };
        expect(richTextRenderer(heading)).toBe(`<h${level}>Heading ${level}</h${level}>`);
      });
    });

    describe('blockquote', () => {
      it('renders blockquote', () => {
        const blockquote: SbRichTextDoc = {
          type: 'blockquote',
          content: [{ type: 'paragraph', content: [text('Quote')] }],
        };
        expect(richTextRenderer(blockquote)).toBe('<blockquote><p>Quote</p></blockquote>');
      });
    });

    describe('lists', () => {
      it('renders bullet list', () => {
        const list: SbRichTextDoc = {
          type: 'bullet_list',
          content: [
            { type: 'list_item', content: [{ type: 'paragraph', content: [text('Item 1')] }] },
            { type: 'list_item', content: [{ type: 'paragraph', content: [text('Item 2')] }] },
          ],
        };
        expect(richTextRenderer(list)).toBe('<ul><li><p>Item 1</p></li><li><p>Item 2</p></li></ul>');
      });

      it('renders ordered list', () => {
        const list: SbRichTextDoc = {
          type: 'ordered_list',
          attrs: { order: 1 },
          content: [
            { type: 'list_item', content: [{ type: 'paragraph', content: [text('First')] }] },
            { type: 'list_item', content: [{ type: 'paragraph', content: [text('Second')] }] },
          ],
        };
        expect(richTextRenderer(list)).toBe('<ol order="1"><li><p>First</p></li><li><p>Second</p></li></ol>');
      });
    });

    describe('code block', () => {
      it('renders code block with language class', () => {
        const codeBlock: SbRichTextDoc = {
          type: 'code_block',
          attrs: { class: 'javascript' },
          content: [text('const x = 1;')],
        };
        expect(richTextRenderer(codeBlock)).toBe('<pre class="javascript"><code class="javascript">const x = 1;</code></pre>');
      });

      it('does not leak language as attribute', () => {
        const codeBlock: SbRichTextDoc = {
          type: 'code_block',
          attrs: { class: 'js' },
          content: [text('code')],
        };
        expect(richTextRenderer(codeBlock)).not.toContain('language=');
      });
    });

    describe('horizontal rule', () => {
      it('renders hr as self-closing', () => {
        expect(richTextRenderer({ type: 'horizontal_rule' })).toBe('<hr />');
      });
    });

    describe('hard break', () => {
      it('renders br as self-closing', () => {
        expect(richTextRenderer({ type: 'hard_break' })).toBe('<br />');
      });
    });

    describe('image', () => {
      it('renders image with attributes', () => {
        const image: SbRichTextDoc = {
          type: 'image',
          attrs: {
            id: 123,
            src: 'https://example.com/image.jpg',
            alt: 'An image',
            title: 'Image title',
            source: null,
            copyright: null,
            meta_data: null,
          },
        };
        expect(richTextRenderer(image)).toBe(
          '<img id="123" src="https://example.com/image.jpg" alt="An image" title="Image title" />',
        );
      });

      it('filters out meta_data, source, and copyright from output', () => {
        const image: SbRichTextDoc = {
          type: 'image',
          attrs: {
            id: 1,
            src: 'https://example.com/img.jpg',
            alt: 'Alt',
            title: null,
            source: 'Source',
            copyright: '© 2024',
            meta_data: { alt: 'meta', title: null, source: null, copyright: null },
          },
        };
        const html = richTextRenderer(image);
        expect(html).not.toContain('source=');
        expect(html).not.toContain('copyright=');
        expect(html).not.toContain('meta_data=');
      });

      it('renders optimized image with optimizeImages: true', () => {
        const image: SbRichTextDoc = {
          type: 'image',
          attrs: {
            id: 1,
            src: 'https://a.storyblok.com/f/12345/image.jpg',
            alt: 'Test',
            title: null,
            source: null,
            copyright: null,
            meta_data: null,
          },
        };
        const html = richTextRenderer(image, { optimizeImages: true });
        expect(html).toContain('src="https://a.storyblok.com/f/12345/image.jpg/m/"');
      });

      it('renders optimized image with width and height', () => {
        const image: SbRichTextDoc = {
          type: 'image',
          attrs: {
            id: 1,
            src: 'https://a.storyblok.com/f/12345/image.jpg',
            alt: 'Test',
            title: null,
            source: null,
            copyright: null,
            meta_data: null,
          },
        };
        const html = richTextRenderer(image, {
          optimizeImages: { width: 800, height: 600 },
        });
        expect(html).toContain('src="https://a.storyblok.com/f/12345/image.jpg/m/800x600/"');
        expect(html).toContain('width="800"');
        expect(html).toContain('height="600"');
      });

      it('renders optimized image with filters', () => {
        const image: SbRichTextDoc = {
          type: 'image',
          attrs: {
            id: 1,
            src: 'https://a.storyblok.com/f/12345/image.jpg',
            alt: 'Test',
            title: null,
            source: null,
            copyright: null,
            meta_data: null,
          },
        };
        const html = richTextRenderer(image, {
          optimizeImages: { filters: { quality: 80, format: 'webp' } },
        });
        expect(html).toContain('filters:quality(80):format(webp)');
      });

      it('renders optimized image with loading attribute', () => {
        const image: SbRichTextDoc = {
          type: 'image',
          attrs: {
            id: 1,
            src: 'https://a.storyblok.com/f/12345/image.jpg',
            alt: 'Test',
            title: null,
            source: null,
            copyright: null,
            meta_data: null,
          },
        };
        const html = richTextRenderer(image, {
          optimizeImages: { loading: 'lazy' },
        });
        expect(html).toContain('loading="lazy"');
      });
    });

    describe('emoji', () => {
      it('renders emoji as image with fallback', () => {
        const emoji: SbRichTextDoc = {
          type: 'emoji',
          attrs: {
            emoji: '🚀',
            name: 'rocket',
            fallbackImage: 'https://cdn.example.com/rocket.png',
          },
        };
        const html = richTextRenderer(emoji);
        expect(html).toContain('<img');
        expect(html).toContain('emoji="🚀"');
        expect(html).toContain('src="https://cdn.example.com/rocket.png"');
      });
    });
  });

  // ============================================================================
  // Tests: Tables
  // ============================================================================

  describe('tables', () => {
    it('renders basic table with tbody', () => {
      const t = table([tableRow([tableCell('A'), tableCell('B')])]);
      expect(richTextRenderer(t)).toBe(
        '<table><tbody><tr><td colspan="1" rowspan="1"><p>A</p></td><td colspan="1" rowspan="1"><p>B</p></td></tr></tbody></table>',
      );
    });

    it('renders table with thead and tbody', () => {
      const t = table([
        tableRow([tableHeader('H1'), tableHeader('H2')]),
        tableRow([tableCell('C1'), tableCell('C2')]),
      ]);
      expect(richTextRenderer(t)).toBe(
        '<table><thead><tr><th colspan="1" rowspan="1"><p>H1</p></th><th colspan="1" rowspan="1"><p>H2</p></th></tr></thead>'
        + '<tbody><tr><td colspan="1" rowspan="1"><p>C1</p></td><td colspan="1" rowspan="1"><p>C2</p></td></tr></tbody></table>',
      );
    });

    it('renders colspan and rowspan', () => {
      const t = table([tableRow([tableCell('Merged', { colspan: 2, rowspan: 2 })])]);
      expect(richTextRenderer(t)).toContain('colspan="2" rowspan="2"');
    });

    it('renders colwidth as style', () => {
      const t = table([tableRow([tableCell('Wide', { colwidth: [200] })])]);
      expect(richTextRenderer(t)).toContain('style="width: 200px;"');
    });

    it('renders backgroundColor as style', () => {
      const t = table([tableRow([tableCell('Colored', { backgroundColor: '#FF0000' })])]);
      expect(richTextRenderer(t)).toContain('background-color: #FF0000;');
    });

    it('combines multiple styles', () => {
      const t = table([tableRow([tableCell('Styled', { colwidth: [100], backgroundColor: '#00FF00' })])]);
      const html = richTextRenderer(t);
      expect(html).toContain('width: 100px;');
      expect(html).toContain('background-color: #00FF00;');
    });
  });

  // ============================================================================
  // Tests: Marks (Inline Formatting)
  // ============================================================================

  describe('marks', () => {
    it('renders bold', () => {
      const node = text('Bold', [{ type: 'bold' }]);
      expect(richTextRenderer(node)).toBe('<strong>Bold</strong>');
    });

    it('renders italic', () => {
      const node = text('Italic', [{ type: 'italic' }]);
      expect(richTextRenderer(node)).toBe('<em>Italic</em>');
    });

    it('renders strike', () => {
      const node = text('Strike', [{ type: 'strike' }]);
      expect(richTextRenderer(node)).toBe('<s>Strike</s>');
    });

    it('renders underline', () => {
      const node = text('Underline', [{ type: 'underline' }]);
      expect(richTextRenderer(node)).toBe('<u>Underline</u>');
    });

    it('renders code', () => {
      const node = text('code', [{ type: 'code' }]);
      expect(richTextRenderer(node)).toBe('<code>code</code>');
    });

    it('renders superscript', () => {
      const node = text('sup', [{ type: 'superscript' }]);
      expect(richTextRenderer(node)).toBe('<sup>sup</sup>');
    });

    it('renders subscript', () => {
      const node = text('sub', [{ type: 'subscript' }]);
      expect(richTextRenderer(node)).toBe('<sub>sub</sub>');
    });

    it('renders nested marks', () => {
      const node = text('Bold Italic', [{ type: 'bold' }, { type: 'italic' }]);
      expect(richTextRenderer(node)).toBe('<em><strong>Bold Italic</strong></em>');
    });

    it('renders anchor mark as span with id', () => {
      const node = text('Anchored', [{ type: 'anchor', attrs: { id: 'section-1' } }]);
      expect(richTextRenderer(node)).toBe('<span id="section-1">Anchored</span>');
    });

    it('renders styled mark with class', () => {
      const node = text('Styled', [{ type: 'styled', attrs: { class: 'highlight' } }]);
      expect(richTextRenderer(node)).toBe('<span class="highlight">Styled</span>');
    });

    it('renders textStyle with color', () => {
      const node = text('Red', [{ type: 'textStyle', attrs: { color: 'red', id: null, class: null } }]);
      expect(richTextRenderer(node)).toBe('<span style="color: red;">Red</span>');
    });
  });

  // ============================================================================
  // Tests: Links
  // ============================================================================

  describe('links', () => {
    it('renders external URL link', () => {
      const node = text('Click', [linkMark('https://example.com', { target: '_blank' })]);
      expect(richTextRenderer(node)).toBe('<a href="https://example.com" target="_blank">Click</a>');
    });

    it('renders internal story link', () => {
      const node = text('Page', [linkMark('/about', { linktype: 'story' })]);
      expect(richTextRenderer(node)).toBe('<a href="/about">Page</a>');
    });

    it('renders story link with anchor', () => {
      const node = text('Section', [linkMark('/page', { linktype: 'story', anchor: 'intro' })]);
      expect(richTextRenderer(node)).toBe('<a href="/page#intro">Section</a>');
    });

    it('renders email link with mailto:', () => {
      const node = text('Email', [linkMark('test@example.com', { linktype: 'email' })]);
      expect(richTextRenderer(node)).toBe('<a href="mailto:test@example.com">Email</a>');
    });

    it('does not duplicate mailto: prefix', () => {
      const node = text('Email', [linkMark('mailto:test@example.com', { linktype: 'email' })]);
      expect(richTextRenderer(node)).toBe('<a href="mailto:test@example.com">Email</a>');
    });

    it('renders asset link', () => {
      const node = text('Download', [linkMark('https://assets.example.com/file.pdf', { linktype: 'asset' })]);
      expect(richTextRenderer(node)).toBe('<a href="https://assets.example.com/file.pdf">Download</a>');
    });

    it('renders link without href when empty', () => {
      const node: SbRichTextDoc = {
        type: 'text',
        text: 'No href',
        marks: [{ type: 'link', attrs: { href: '', linktype: 'url', uuid: null, anchor: null, target: null } }],
      };
      expect(richTextRenderer(node)).toBe('<a>No href</a>');
    });

    it('filters null attributes', () => {
      const node = text('Link', [linkMark('/')]);
      const html = richTextRenderer(node);
      expect(html).not.toContain('target=');
      expect(html).not.toContain('uuid=');
      expect(html).not.toContain('anchor=');
    });
  });

  // ============================================================================
  // Tests: Link Mark Merging
  // ============================================================================

  describe('link mark merging', () => {
    it('merges adjacent text nodes with same link', () => {
      const content: SbRichTextDoc = {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [
            text('Hello ', [linkMark('/url')]),
            text('World', [linkMark('/url')]),
          ],
        }],
      };
      expect(richTextRenderer(content)).toBe('<p><a href="/url">Hello World</a></p>');
    });

    it('preserves inner marks when merging', () => {
      const content: SbRichTextDoc = {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [
            text('normal ', [linkMark('/url')]),
            text('bold', [{ type: 'bold' }, linkMark('/url')]),
            text(' text', [linkMark('/url')]),
          ],
        }],
      };
      expect(richTextRenderer(content)).toBe('<p><a href="/url">normal <strong>bold</strong> text</a></p>');
    });

    it('handles multiple inner marks', () => {
      const content: SbRichTextDoc = {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [
            text('start ', [linkMark('/url')]),
            text('bold', [{ type: 'bold' }, linkMark('/url')]),
            text(' and ', [linkMark('/url')]),
            text('italic', [{ type: 'italic' }, linkMark('/url')]),
            text(' end', [linkMark('/url')]),
          ],
        }],
      };
      expect(richTextRenderer(content)).toBe(
        '<p><a href="/url">start <strong>bold</strong> and <em>italic</em> end</a></p>',
      );
    });

    it('breaks group on non-text node', () => {
      const content: SbRichTextDoc = {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [
            text('Before ', [linkMark('/x')]),
            { type: 'hard_break' },
            text('After', [linkMark('/x')]),
          ],
        }],
      };
      expect(richTextRenderer(content)).toBe('<p><a href="/x">Before </a><br /><a href="/x">After</a></p>');
    });

    it('separates groups when link attrs differ', () => {
      const content: SbRichTextDoc = {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [
            text('A', [linkMark('/a')]),
            text('B', [linkMark('/a', { target: '_blank' })]),
          ],
        }],
      };
      expect(richTextRenderer(content)).toBe('<p><a href="/a">A</a><a href="/a" target="_blank">B</a></p>');
    });
  });

  // ============================================================================
  // Tests: Text Alignment
  // ============================================================================

  describe('text alignment', () => {
    it('renders paragraph with text-align style', () => {
      const p: SbRichTextDoc = {
        type: 'paragraph',
        attrs: { textAlign: 'right' },
        content: [text('Right')],
      };
      expect(richTextRenderer(p)).toBe('<p style="text-align: right;">Right</p>');
    });

    it.each(['left', 'center', 'right', 'justify'] as const)('supports %s alignment', (align) => {
      const p: SbRichTextDoc = {
        type: 'paragraph',
        attrs: { textAlign: align },
        content: [text('Text')],
      };
      expect(richTextRenderer(p)).toContain(`text-align: ${align};`);
    });

    it('renders heading with alignment', () => {
      const heading: SbRichTextDoc = {
        type: 'heading',
        attrs: { level: 2, textAlign: 'center' },
        content: [text('Centered')],
      };
      expect(richTextRenderer(heading)).toBe('<h2 style="text-align: center;">Centered</h2>');
    });

    it('combines alignment with marks', () => {
      const p: SbRichTextDoc = {
        type: 'paragraph',
        attrs: { textAlign: 'center' },
        content: [text('Styled', [{ type: 'bold' }])],
      };
      expect(richTextRenderer(p)).toBe('<p style="text-align: center;"><strong>Styled</strong></p>');
    });

    it('renders empty paragraph with alignment', () => {
      const p: SbRichTextDoc = {
        type: 'paragraph',
        attrs: { textAlign: 'center' },
        content: [],
      };
      expect(richTextRenderer(p)).toBe('<p style="text-align: center;"></p>');
    });
  });

  // ============================================================================
  // Tests: Custom Renderers
  // ============================================================================

  describe('custom renderers', () => {
    it('overrides node rendering', () => {
      const options: SbRichTextOptions = {
        renderers: {
          paragraph: ({ content }) => `<div class="custom">${richTextRenderer(content, options)}</div>`,
        },
      };
      const node: SbRichTextDoc = { type: 'paragraph', content: [text('Hello')] };
      expect(richTextRenderer(node, options)).toBe('<div class="custom">Hello</div>');
    });

    it('overrides mark rendering', () => {
      const options: SbRichTextOptions = {
        renderers: {
          bold: ({ children }) => `<b class="heavy">${children}</b>`,
        },
      };
      expect(richTextRenderer(text('Bold', [{ type: 'bold' }]), options)).toBe('<b class="heavy">Bold</b>');
    });

    it('supports multiple custom renderers', () => {
      const options: SbRichTextOptions = {
        renderers: {
          heading: ({ attrs, content }) => `<h${attrs?.level} class="title">${richTextRenderer(content, options)}</h${attrs?.level}>`,
          bold: ({ children }) => `<strong class="emphasis">${children}</strong>`,
        },
      };
      const heading: SbRichTextDoc = {
        type: 'heading',
        attrs: { level: 1, textAlign: null },
        content: [text('Title', [{ type: 'bold' }])],
      };
      expect(richTextRenderer(heading, options)).toBe(
        '<h1 class="title"><strong class="emphasis">Title</strong></h1>',
      );
    });
  });

  // ============================================================================
  // Tests: Blok Nodes
  // ============================================================================

  describe('blok nodes', () => {
    const blokDoc: SbRichTextDoc = {
      type: 'doc',
      content: [{
        type: 'blok',
        attrs: {
          id: 'blok-123',
          body: [
            { _uid: '1', component: 'button', title: 'Click Me' },
            { _uid: '2', component: 'button', title: 'Submit' },
          ],
        },
      }],
    };

    it('warns when no custom renderer provided', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      richTextRenderer(blokDoc);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('blok'));
      warnSpy.mockRestore();
    });

    it('returns empty string without custom renderer', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(richTextRenderer(blokDoc)).toBe('');
      vi.restoreAllMocks();
    });

    it('renders with custom blok renderer', () => {
      const options: SbRichTextOptions = {
        renderers: {
          blok: ({ attrs }) => {
            const body = Array.isArray(attrs?.body) ? attrs.body : [];
            return body.map(b => `<button data-uid="${b._uid}">${b.title}</button>`).join('');
          },
        },
      };
      expect(richTextRenderer(blokDoc, options)).toBe(
        '<button data-uid="1">Click Me</button><button data-uid="2">Submit</button>',
      );
    });

    it('handles empty body', () => {
      const emptyBlok: SbRichTextDoc = {
        type: 'doc',
        content: [{ type: 'blok', attrs: { id: 'x', body: [] } }],
      };
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(richTextRenderer(emptyBlok)).toBe('');
      vi.restoreAllMocks();
    });

    it('handles null body', () => {
      const nullBlok: SbRichTextDoc = {
        type: 'doc',
        content: [{ type: 'blok', attrs: { id: 'x', body: null } }],
      };
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(richTextRenderer(nullBlok)).toBe('');
      vi.restoreAllMocks();
    });

    it('works alongside other content', () => {
      const options: SbRichTextOptions = {
        renderers: {
          blok: () => '<widget />',
        },
      };
      const content: SbRichTextDoc = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [text('Before')] },
          { type: 'blok', attrs: { id: 'x', body: [{ _uid: '1' }] } },
          { type: 'paragraph', content: [text('After')] },
        ],
      };
      expect(richTextRenderer(content, options)).toBe('<p>Before</p><widget /><p>After</p>');
    });
  });

  // ============================================================================
  // Tests: XSS Prevention
  // ============================================================================

  describe('xSS prevention', () => {
    it('escapes HTML in text content', () => {
      const node = text('<script>alert("xss")</script>');
      expect(richTextRenderer(node)).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('escapes HTML in attributes', () => {
      const node = text('Link', [linkMark('javascript:alert("xss")')]);
      expect(richTextRenderer(node)).toContain('href="javascript:alert(&quot;xss&quot;)"');
    });
  });
});
