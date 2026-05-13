import { describe, expect, it } from 'vitest';
import { htmlToStoryblokRichtext } from './html-parser';
import { renderRichText, type SbRichTextDoc } from './static';
import { mapToAttribute } from './extensions/utils';

// ============================================================================
// Helper
// ============================================================================
function doc(content: SbRichTextDoc | SbRichTextDoc[]): SbRichTextDoc {
  return {
    type: 'doc',
    content: Array.isArray(content) ? content : [content],
  };
}

// ============================================================================
// Tests: Input Handling
// ============================================================================

describe('hTML → Richtext (strict): Input handling', () => {
  it('returns doc with empty paragraph for empty string', () => {
    const document = htmlToStoryblokRichtext('');
    expect(document).toMatchObject(doc({ type: 'paragraph' }));
  });

  it('returns doc with empty paragraph for whitespace-only input', () => {
    const document = htmlToStoryblokRichtext('   \n\t  ');
    expect(document).toMatchObject(doc({ type: 'paragraph' }));
  });

  it('parses simple text as paragraph', () => {
    const document = htmlToStoryblokRichtext('Hello World');
    expect(document).toMatchObject(doc({ type: 'paragraph', content: [{ type: 'text', text: 'Hello World' }] }));
  });
});

// ============================================================================
// Tests: Node Types
// ============================================================================

describe('hTML → Richtext (strict): Node types', () => {
  describe('paragraph', () => {
    it('parses paragraph and renders back to identical HTML', () => {
      const html = '<p>Hello</p>';
      const document = htmlToStoryblokRichtext(html);
      expect(document).toEqual(doc({
        type: 'paragraph',
        attrs: { textAlign: null },
        content: [{ type: 'text', text: 'Hello' }],
      }));
      expect(renderRichText(document)).toBe(html);
    });

    it('parses empty paragraph', () => {
      const document = htmlToStoryblokRichtext('<p></p>');
      expect(document).toMatchObject(doc({ type: 'paragraph' }));
      expect(document.content![0].content).toBeUndefined();
    });

    it('parses multiple paragraphs', () => {
      const document = htmlToStoryblokRichtext('<p>First</p><p>Second</p>');
      expect(document.content).toHaveLength(2);
      expect(document).toMatchObject(doc([
        { type: 'paragraph', attrs: { textAlign: null }, content: [{ type: 'text', text: 'First' }] },
        { type: 'paragraph', attrs: { textAlign: null }, content: [{ type: 'text', text: 'Second' }] },
      ]));
    });
    it('parses paragraphs with textAlign attribute', () => {
      const document = htmlToStoryblokRichtext('<p style="text-align: center;">First</p><p style="text-align: right;">Second</p>');
      expect(document.content).toHaveLength(2);
      expect(document).toMatchObject(doc([
        { type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: 'First' }] },
        { type: 'paragraph', attrs: { textAlign: 'right' }, content: [{ type: 'text', text: 'Second' }] },
      ]));
    });
  });

  describe('heading', () => {
    it.each([1, 2, 3, 4, 5, 6] as const)('parses h%i and renders back', (level) => {
      const html = `<h${level}>Heading ${level}</h${level}>`;
      const document = htmlToStoryblokRichtext(html);
      expect(document).toEqual(doc({
        type: 'heading',
        attrs: { level, textAlign: null },
        content: [{ type: 'text', text: `Heading ${level}` }],
      }));
      expect(renderRichText(document)).toBe(html);
    });

    it('parses heading with nested marks', () => {
      const document = htmlToStoryblokRichtext('<h1><strong>Bold</strong> Heading</h1>');
      expect(document).toMatchObject(doc({
        type: 'heading',
        attrs: { level: 1, textAlign: null },
        content: [
          { type: 'text', text: 'Bold', marks: [{ type: 'bold' }] },
          { type: 'text', text: ' Heading' },
        ],
      }));
    });
  });

  describe('blockquote', () => {
    it('parses blockquote and renders back', () => {
      const html = '<blockquote><p>Quote</p></blockquote>';
      const document = htmlToStoryblokRichtext(html);
      expect(document).toEqual(doc({
        type: 'blockquote',
        content: [{ type: 'paragraph', attrs: { textAlign: null }, content: [{ type: 'text', text: 'Quote' }] }],
      }));
      expect(renderRichText(document)).toBe(html);
    });

    it('parses nested blockquotes', () => {
      const document = htmlToStoryblokRichtext('<blockquote><p>Outer</p><blockquote><p>Inner</p></blockquote></blockquote>');
      expect(document).toMatchObject(doc({
        type: 'blockquote',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Outer' }] },
          { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Inner' }] }] },
        ],
      }));
    });
  });

  describe('bullet_list', () => {
    it('parses bullet list and renders back', () => {
      const html = '<ul><li><p>Item 1</p></li><li><p>Item 2</p></li></ul>';
      const document = htmlToStoryblokRichtext(html);
      expect(document).toEqual(doc({
        type: 'bullet_list',
        content: [
          { type: 'list_item', content: [{ type: 'paragraph', attrs: { textAlign: null }, content: [{ type: 'text', text: 'Item 1' }] }] },
          { type: 'list_item', content: [{ type: 'paragraph', attrs: { textAlign: null }, content: [{ type: 'text', text: 'Item 2' }] }] },
        ],
      }));
      expect(renderRichText(document)).toBe(html);
    });

    it('parses nested bullet lists', () => {
      const document = htmlToStoryblokRichtext('<ul><li><p>Parent</p><ul><li><p>Child</p></li></ul></li></ul>');
      expect(document).toMatchObject(doc({
        type: 'bullet_list',
        content: [{
          type: 'list_item',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Parent' }] },
            { type: 'bullet_list', content: [{ type: 'list_item', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Child' }] }] }] },
          ],
        }],
      }));
    });
  });

  describe('ordered_list', () => {
    it('parses ordered list and renders back', () => {
      const html = '<ol><li><p>First</p></li><li><p>Second</p></li></ol>';
      const document = htmlToStoryblokRichtext(html);
      expect(document).toEqual(doc({
        type: 'ordered_list',
        attrs: { order: 1 },
        content: [
          { type: 'list_item', content: [{ type: 'paragraph', attrs: { textAlign: null }, content: [{ type: 'text', text: 'First' }] }] },
          { type: 'list_item', content: [{ type: 'paragraph', attrs: { textAlign: null }, content: [{ type: 'text', text: 'Second' }] }] },
        ],
      }));
      expect(renderRichText(document)).toBe(html);
    });

    it('preserves start attribute', () => {
      const document = htmlToStoryblokRichtext('<ol start="5"><li><p>Fifth</p></li></ol>');
      expect(document).toEqual(doc({
        type: 'ordered_list',
        attrs: { order: 5 },
        content: [{ type: 'list_item', content: [{ type: 'paragraph', attrs: { textAlign: null }, content: [{ type: 'text', text: 'Fifth' }] }] }],
      }));
    });
  });

  describe('code_block', () => {
    it('parses code block', () => {
      const document = htmlToStoryblokRichtext('<pre><code>const x = 1;</code></pre>');
      expect(document).toEqual(doc({
        type: 'code_block',
        attrs: { class: null },
        content: [{ type: 'text', text: 'const x = 1;' }],
      }));
    });

    it('parses multiline code block', () => {
      const document = htmlToStoryblokRichtext('<pre><code>function hello() {\n  console.log("Hello");\n}</code></pre>');
      expect(document.content![0]).toMatchObject({
        type: 'code_block',
        content: [{ type: 'text', text: 'function hello() {\n  console.log("Hello");\n}' }],
      });
    });
  });

  describe('horizontal_rule', () => {
    it('parses hr', () => {
      const document = htmlToStoryblokRichtext('<hr>');
      expect(document).toEqual(doc({ type: 'horizontal_rule' }));
    });

    it('parses self-closing hr', () => {
      const document = htmlToStoryblokRichtext('<hr/>');
      expect(document.content![0]).toMatchObject({ type: 'horizontal_rule' });
    });
  });

  describe('hard_break', () => {
    it('parses br inside paragraph and renders back', () => {
      const html = '<p>Line1<br>Line2</p>';
      const document = htmlToStoryblokRichtext(html);
      expect(document).toEqual(doc({
        type: 'paragraph',
        attrs: { textAlign: null },
        content: [
          { type: 'text', text: 'Line1' },
          { type: 'hard_break' },
          { type: 'text', text: 'Line2' },
        ],
      }));
      expect(renderRichText(document)).toBe(html);
    });
  });

  describe('image', () => {
    it('parses image with all attributes', () => {
      const document = htmlToStoryblokRichtext('<img src="https://example.com/image.jpg" alt="An image" title="Image title">');
      expect(document.content![0]).toMatchObject({
        type: 'image',
        attrs: {
          src: 'https://example.com/image.jpg',
          alt: 'An image',
          title: 'Image title',
        },
      });
    });

    it('parses image inside paragraph', () => {
      const document = htmlToStoryblokRichtext('<p><img src="https://example.com/img.jpg"></p>');
      expect(document.content![0]).toBeDefined();
    });
  });

  describe('emoji', () => {
    it('parses emoji node type', () => {
      const document = htmlToStoryblokRichtext('<p><img data-emoji="🚀" data-name="rocket" src="https://cdn.example.com/rocket.png"></p>');
      expect(document.content![0].type).toBe('paragraph');
    });
  });

  describe('table', () => {
    it('parses table with tbody', () => {
      const document = htmlToStoryblokRichtext('<table><tbody><tr><td><p>A</p></td><td><p>B</p></td></tr></tbody></table>');
      expect(document.content![0]).toMatchObject({
        type: 'table',
        content: [{
          type: 'tableRow',
          content: [
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A' }] }] },
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'B' }] }] },
          ],
        }],
      });
    });

    it('parses table with thead and tbody', () => {
      const document = htmlToStoryblokRichtext('<table><thead><tr><th><p>H1</p></th><th><p>H2</p></th></tr></thead><tbody><tr><td><p>C1</p></td><td><p>C2</p></td></tr></tbody></table>');
      expect(document.content![0]).toMatchObject({
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'H1' }] }] },
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'H2' }] }] },
            ],
          },
          {
            type: 'tableRow',
            content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'C1' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'C2' }] }] },
            ],
          },
        ],
      });
    });

    it('parses table with colspan and rowspan', () => {
      const document = htmlToStoryblokRichtext('<table><tbody><tr><td colspan="2" rowspan="2"><p>Merged</p></td></tr></tbody></table>');
      const cell = document.content![0].content![0].content![0];
      expect(cell.attrs).toMatchObject({ colspan: 2, rowspan: 2 });
    });

    it('parses table and renders back', () => {
      const html = '<table><tbody><tr><td colspan="1" rowspan="1"><p>A</p></td><td colspan="1" rowspan="1"><p>B</p></td></tr></tbody></table>';
      const document = htmlToStoryblokRichtext(html);
      expect(document).toEqual(doc({
        type: 'table',
        content: [{
          type: 'tableRow',
          content: [
            { type: 'tableCell', attrs: { colspan: 1, rowspan: 1, backgroundColor: null, colwidth: null }, content: [{ type: 'paragraph', attrs: { textAlign: null }, content: [{ type: 'text', text: 'A' }] }] },
            { type: 'tableCell', attrs: { colspan: 1, rowspan: 1, backgroundColor: null, colwidth: null }, content: [{ type: 'paragraph', attrs: { textAlign: null }, content: [{ type: 'text', text: 'B' }] }] },
          ],
        }],
      }));
    });
  });

  describe('details', () => {
    it('parses details with summary', () => {
      const document = htmlToStoryblokRichtext('<details><summary>Click to expand</summary><p>Hidden content</p></details>');
      expect(document.content![0]).toMatchObject({
        type: 'details',
        content: [
          { type: 'detailsSummary', content: [{ type: 'text', text: 'Click to expand' }] },
          { type: 'detailsContent', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hidden content' }] }] },
        ],
      });
    });
  });

  describe('blok', () => {
    it('parses blok from custom data-component markup', () => {
      const html = '<div data-component="hero" data-id="abc-123" data-props=\'{"title":"Hello"}\'></div>';
      const result = htmlToStoryblokRichtext(html, {
        parsers: {
          blok: {
            parseHTML: () => [{ tag: 'div[data-component]' }],
            attributeParsers: {
              id: mapToAttribute('data-id'),
              body: (el) => {
                const jsonData = el.getAttribute('data-props');
                const component = el.getAttribute('data-component');
                if (jsonData && component) {
                  return [{ _uid: el.getAttribute('data-id') || 'uid', component, ...JSON.parse(jsonData) }];
                }
                return null;
              },
            },
          },
        },
      });
      expect(result).toEqual(doc({
        type: 'blok',
        attrs: {
          id: 'abc-123',
          body: [{ _uid: 'abc-123', component: 'hero', title: 'Hello' }],
        },
      }));
    });
  });
});

// ============================================================================
// Tests: Mark Types
// ============================================================================

describe('hTML → Richtext (strict): Mark types', () => {
  describe('bold', () => {
    it('parses <strong> tag', () => {
      const document = htmlToStoryblokRichtext('<p><strong>Bold</strong></p>');
      expect(document.content![0].content![0]).toMatchObject({
        type: 'text',
        text: 'Bold',
        marks: [{ type: 'bold' }],
      });
    });

    it('parses <b> tag', () => {
      const document = htmlToStoryblokRichtext('<p><b>Bold</b></p>');
      expect(document.content![0].content![0]).toMatchObject({
        type: 'text',
        text: 'Bold',
        marks: [{ type: 'bold' }],
      });
    });
  });

  describe('italic', () => {
    it('parses <em> tag', () => {
      const document = htmlToStoryblokRichtext('<p><em>Italic</em></p>');
      expect(document.content![0].content![0]).toMatchObject({
        type: 'text',
        text: 'Italic',
        marks: [{ type: 'italic' }],
      });
    });

    it('parses <i> tag', () => {
      const document = htmlToStoryblokRichtext('<p><i>Italic</i></p>');
      expect(document.content![0].content![0]).toMatchObject({
        type: 'text',
        text: 'Italic',
        marks: [{ type: 'italic' }],
      });
    });
  });

  describe('strike', () => {
    it('parses <s> tag', () => {
      const document = htmlToStoryblokRichtext('<p><s>Strike</s></p>');
      expect(document.content![0].content![0]).toMatchObject({
        type: 'text',
        text: 'Strike',
        marks: [{ type: 'strike' }],
      });
    });

    it('parses <del> tag', () => {
      const document = htmlToStoryblokRichtext('<p><del>Strike</del></p>');
      expect(document.content![0].content![0]).toMatchObject({
        type: 'text',
        text: 'Strike',
        marks: [{ type: 'strike' }],
      });
    });
  });

  describe('underline', () => {
    it('parses <u> tag', () => {
      const document = htmlToStoryblokRichtext('<p><u>Underline</u></p>');
      expect(document.content![0].content![0]).toMatchObject({
        type: 'text',
        text: 'Underline',
        marks: [{ type: 'underline' }],
      });
    });
  });

  describe('code', () => {
    it('parses <code> tag', () => {
      const document = htmlToStoryblokRichtext('<p><code>code</code></p>');
      expect(document.content![0].content![0]).toMatchObject({
        type: 'text',
        text: 'code',
        marks: [{ type: 'code' }],
      });
    });
  });

  describe('superscript', () => {
    it('parses <sup> tag', () => {
      const document = htmlToStoryblokRichtext('<p><sup>sup</sup></p>');
      expect(document.content![0].content![0]).toMatchObject({
        type: 'text',
        text: 'sup',
        marks: [{ type: 'superscript' }],
      });
    });
  });

  describe('subscript', () => {
    it('parses <sub> tag', () => {
      const document = htmlToStoryblokRichtext('<p><sub>sub</sub></p>');
      expect(document.content![0].content![0]).toMatchObject({
        type: 'text',
        text: 'sub',
        marks: [{ type: 'subscript' }],
      });
    });
  });

  describe('highlight', () => {
    it('parses <mark> tag', () => {
      const document = htmlToStoryblokRichtext('<p><mark>Highlighted</mark></p>');
      expect(document.content![0].content![0]).toMatchObject({
        type: 'text',
        text: 'Highlighted',
        marks: [{ type: 'highlight' }],
      });
    });
  });

  describe('textStyle', () => {
    it('parses span with inline color style', () => {
      const document = htmlToStoryblokRichtext('<p><span style="color: red">Colored</span></p>');
      expect(document).toEqual(
        doc({
          type: 'paragraph',
          attrs: { textAlign: null },
          content: [
            {
              type: 'text',
              text: 'Colored',
              marks: [{ type: 'textStyle', attrs: { color: 'red' } }],
            },
          ],
        }),
      );
    });
  });

  describe('anchor', () => {
    it('parses span with id attribute', () => {
      const document = htmlToStoryblokRichtext('<p><span id="section-1">Anchored</span></p>');
      const textNode = document.content![0].content![0];
      expect(textNode).toMatchObject({ type: 'text', text: 'Anchored' });
      const anchorMark = textNode.marks?.find(m => m.type === 'anchor');
      expect(anchorMark).toMatchObject({ type: 'anchor', attrs: { id: 'section-1' } });
    });
  });

  describe('styled', () => {
    it('parses span with class attribute', () => {
      const document = htmlToStoryblokRichtext('<p><span class="highlight">Styled</span></p>');
      expect(document).toEqual(doc({
        type: 'paragraph',
        attrs: { textAlign: null },
        content: [{
          type: 'text',
          text: 'Styled',
          marks: [{ type: 'styled', attrs: { class: 'highlight' } }],
        }],
      }));
    });
  });

  describe('nested marks', () => {
    it('parses multiple nested marks', () => {
      const document = htmlToStoryblokRichtext('<p><strong><em>Bold Italic</em></strong></p>');
      expect(document).toEqual(doc({
        type: 'paragraph',
        attrs: { textAlign: null },
        content: [{
          type: 'text',
          text: 'Bold Italic',
          marks: [{ type: 'bold' }, { type: 'italic' }],
        }],
      }));
    });

    it('handles adjacent text with different marks', () => {
      const document = htmlToStoryblokRichtext('<p><strong>Bold</strong><em>Italic</em></p>');
      expect(document.content![0].content).toHaveLength(2);
      expect(document.content![0].content![0]).toMatchObject({ type: 'text', text: 'Bold', marks: [{ type: 'bold' }] });
      expect(document.content![0].content![1]).toMatchObject({ type: 'text', text: 'Italic', marks: [{ type: 'italic' }] });
    });
  });

  describe('plain span', () => {
    it('parses plain span as plain text', () => {
      const document = htmlToStoryblokRichtext('<p><span>Plain text</span></p>');
      expect(document.content![0].content![0]).toMatchObject({ type: 'text', text: 'Plain text' });
    });
  });
});

// ============================================================================
// Tests: Links
// ============================================================================

describe('hTML → Richtext (strict): Links', () => {
  it('parses external URL link', () => {
    const document = htmlToStoryblokRichtext('<p><a href="https://example.com" target="_blank">Click</a></p>');
    expect(document.content![0].content![0]).toMatchObject({
      type: 'text',
      text: 'Click',
      marks: [{ type: 'link', attrs: { href: 'https://example.com', target: '_blank', linktype: 'url' } }],
    });
  });

  it('parses internal link', () => {
    const document = htmlToStoryblokRichtext('<p><a href="/about">About</a></p>');
    expect(document.content![0].content![0]).toMatchObject({
      type: 'text',
      text: 'About',
      marks: [{ type: 'link', attrs: { href: '/about', linktype: 'url' } }],
    });
  });

  it('parses story link', () => {
    const document = htmlToStoryblokRichtext('<p><a href="/about" data-uuid="abc-123" data-linktype="story">About</a></p>');
    expect(document.content![0].content![0].marks![0].attrs).toMatchObject({
      href: '/about',
      uuid: 'abc-123',
      linktype: 'story',
    });
  });

  it('parses story link with anchor', () => {
    const document = htmlToStoryblokRichtext('<p><a href="/page#intro" data-linktype="story" data-anchor="intro">Section</a></p>');
    expect(document.content![0].content![0].marks![0].attrs).toMatchObject({
      href: '/page#intro',
      linktype: 'story',
      anchor: 'intro',
    });
  });

  it('parses email link', () => {
    const document = htmlToStoryblokRichtext('<p><a href="mailto:test@example.com" data-linktype="email">Email</a></p>');
    expect(document.content![0].content![0].marks![0].attrs).toMatchObject({
      href: 'mailto:test@example.com',
      linktype: 'email',
    });
  });

  it('parses asset link', () => {
    const document = htmlToStoryblokRichtext('<p><a href="https://assets.example.com/file.pdf" data-linktype="asset">Download</a></p>');
    expect(document.content![0].content![0].marks![0].attrs).toMatchObject({
      href: 'https://assets.example.com/file.pdf',
      linktype: 'asset',
    });
  });

  it('parses tel: link', () => {
    const document = htmlToStoryblokRichtext('<p><a href="tel:+44 3457 911 911">+44 3457 911 911</a></p>');
    expect(document.content![0].content![0]).toMatchObject({
      type: 'text',
      text: '+44 3457 911 911',
      marks: [{ type: 'link', attrs: { href: 'tel:+44 3457 911 911', linktype: 'url' } }],
    });
  });

  it('parses link with custom attributes', () => {
    const document = htmlToStoryblokRichtext('<p><a href="https://example.com" title="google" rel="noopener" data-custom="foo">Click me</a></p>');
    expect(document).toEqual(doc({
      type: 'paragraph',
      attrs: { textAlign: null },
      content: [{
        type: 'text',
        marks: [{
          type: 'link',
          attrs: {
            href: 'https://example.com',
            uuid: null,
            anchor: null,
            target: null,
            linktype: 'url',
            custom: { 'title': 'google', 'rel': 'noopener', 'data-custom': 'foo' },
          },
        }],
        text: 'Click me',
      }],
    }));
  });

  it('defaults linktype to url', () => {
    const document = htmlToStoryblokRichtext('<p><a href="/path">Link</a></p>');
    expect(document.content![0].content![0].marks![0].attrs!.linktype).toBe('url');
  });

  it('renders external link back to HTML', () => {
    const document = htmlToStoryblokRichtext('<p><a href="https://example.com" target="_blank">Click</a></p>');
    expect(document).toEqual(doc({
      type: 'paragraph',
      attrs: { textAlign: null },
      content: [{
        type: 'text',
        text: 'Click',
        marks: [{ type: 'link', attrs: { href: 'https://example.com', target: '_blank', anchor: null, custom: {}, linktype: 'url', uuid: null } }],
      }],
    }));
  });
});

// ============================================================================
// Tests: Node Type Naming Convention
// ============================================================================

describe('hTML → Richtext (strict): Node type naming', () => {
  it('uses snake_case for list types', () => {
    const document = htmlToStoryblokRichtext('<ul><li><p>A</p></li></ul><ol><li><p>B</p></li></ol>');
    expect(document.content![0].type).toBe('bullet_list');
    expect(document.content![0].content![0].type).toBe('list_item');
    expect(document.content![1].type).toBe('ordered_list');
    expect(document.content![1].content![0].type).toBe('list_item');
  });

  it('uses snake_case for code_block', () => {
    const document = htmlToStoryblokRichtext('<pre><code>x</code></pre>');
    expect(document.content![0].type).toBe('code_block');
  });

  it('uses snake_case for horizontal_rule', () => {
    const document = htmlToStoryblokRichtext('<hr>');
    expect(document.content![0].type).toBe('horizontal_rule');
  });

  it('uses snake_case for hard_break', () => {
    const document = htmlToStoryblokRichtext('<p>a<br>b</p>');
    expect(document.content![0].content![1].type).toBe('hard_break');
  });

  it('uses camelCase for table types', () => {
    const document = htmlToStoryblokRichtext('<table><thead><tr><th><p>H</p></th></tr></thead><tbody><tr><td><p>C</p></td></tr></tbody></table>');
    expect(document.content![0].type).toBe('table');
    expect(document.content![0].content![0].type).toBe('tableRow');
    expect(document.content![0].content![0].content![0].type).toBe('tableHeader');
    expect(document.content![0].content![1].content![0].type).toBe('tableCell');
  });

  it('uses camelCase for details types', () => {
    const document = htmlToStoryblokRichtext('<details><summary>Summary</summary><p>Content</p></details>');
    expect(document.content![0].type).toBe('details');
    expect(document.content![0].content![0].type).toBe('detailsSummary');
    expect(document.content![0].content![1].type).toBe('detailsContent');
  });
});

// ============================================================================
// Tests: Edge Cases
// ============================================================================

describe('hTML → Richtext (strict): Edge cases', () => {
  it('handles malformed HTML gracefully', () => {
    const document = htmlToStoryblokRichtext('<p>Unclosed paragraph');
    expect(document.content![0]).toMatchObject({
      type: 'paragraph',
      content: [{ type: 'text', text: 'Unclosed paragraph' }],
    });
  });

  it('handles HTML entities', () => {
    const document = htmlToStoryblokRichtext('<p>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</p>');
    expect(document).toEqual(doc({
      type: 'paragraph',
      attrs: { textAlign: null },
      content: [{ text: '<script>alert("xss")</script>', type: 'text' }],
    }));
  });

  it('handles unicode characters', () => {
    const document = htmlToStoryblokRichtext('<p>Hello 🌍🚀</p>');
    expect(document).toEqual(doc({
      type: 'paragraph',
      attrs: { textAlign: null },
      content: [{ text: 'Hello 🌍🚀', type: 'text' }],
    }));
  });

  it('handles empty elements', () => {
    const document = htmlToStoryblokRichtext('<p></p><h1></h1><blockquote></blockquote>');
    expect(document).toEqual(doc([
      { type: 'paragraph', attrs: { textAlign: null } },
      { type: 'heading', attrs: { level: 1, textAlign: null } },
      { type: 'blockquote', content: [{ type: 'paragraph', attrs: { textAlign: null } }] },
    ]));
  });

  it('strips unsupported elements but keeps content', () => {
    const document = htmlToStoryblokRichtext('<p><span>Text in span</span></p>');
    expect(document).toEqual(doc({
      type: 'paragraph',
      attrs: { textAlign: null },
      content: [{ text: 'Text in span', type: 'text' }],
    }));
  });

  it('handles special characters', () => {
    const document = htmlToStoryblokRichtext('<p>Special chars: &amp; &lt; &gt; &quot; &#39;</p>');
    expect(document).toEqual(doc({
      type: 'paragraph',
      attrs: { textAlign: null },
      content: [{ text: 'Special chars: & < > " \'', type: 'text' }],
    }));
  });

  it('handles non-breaking spaces', () => {
    const document = htmlToStoryblokRichtext('<p>Hello&nbsp;World</p>');
    expect(document).toEqual(doc({
      type: 'paragraph',
      attrs: { textAlign: null },
      content: [{ text: 'Hello\u00A0World', type: 'text' }],
    }));
  });
});

// ============================================================================
// Tests: Complex Structures
// ============================================================================

describe('hTML → Richtext (strict): Complex structures', () => {
  it('parses mixed content: paragraphs, headings, lists', () => {
    const document = htmlToStoryblokRichtext(`
      <h1>Title</h1>
      <p>Introduction paragraph.</p>
      <h2>Section 1</h2>
      <ul><li><p>Item A</p></li><li><p>Item B</p></li></ul>
      <h2>Section 2</h2>
      <ol><li><p>Step 1</p></li><li><p>Step 2</p></li></ol>
    `);
    expect(document.content!.length).toBeGreaterThan(5);
    expect(document.content![0]).toMatchObject({ type: 'heading', attrs: { level: 1 } });
    expect(document.content![1]).toMatchObject({ type: 'paragraph' });
    expect(document.content![2]).toMatchObject({ type: 'heading', attrs: { level: 2 } });
    expect(document.content![3]).toMatchObject({ type: 'bullet_list' });
    expect(document.content![4]).toMatchObject({ type: 'heading', attrs: { level: 2 } });
    expect(document.content![5]).toMatchObject({ type: 'ordered_list' });
  });

  it('parses blockquote with nested formatting', () => {
    const document = htmlToStoryblokRichtext('<blockquote><p><strong>Important:</strong> This is a <em>quote</em>.</p></blockquote>');
    expect(document.content![0]).toMatchObject({
      type: 'blockquote',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Important:', marks: [{ type: 'bold' }] },
          { type: 'text', text: ' This is a ' },
          { type: 'text', text: 'quote', marks: [{ type: 'italic' }] },
          { type: 'text', text: '.' },
        ],
      }],
    });
  });

  it('parses table with marks inside cells', () => {
    const document = htmlToStoryblokRichtext('<table><tbody><tr><td><p><strong>Bold cell</strong></p></td><td><p><em>Italic cell</em></p></td></tr></tbody></table>');
    const row = document.content![0].content![0];
    expect(row.content![0].content![0].content![0]).toMatchObject({
      type: 'text',
      text: 'Bold cell',
      marks: [{ type: 'bold' }],
    });
    expect(row.content![1].content![0].content![0]).toMatchObject({
      type: 'text',
      text: 'Italic cell',
      marks: [{ type: 'italic' }],
    });
  });

  it('parses heading with link inside', () => {
    const document = htmlToStoryblokRichtext('<h1>Custom Heading with <a href="https://example.com">a link</a>.</h1>');
    expect(document.content![0]).toMatchObject({
      type: 'heading',
      attrs: { level: 1 },
      content: [
        { type: 'text', text: 'Custom Heading with ' },
        { type: 'text', text: 'a link', marks: [{ type: 'link', attrs: expect.objectContaining({ href: 'https://example.com' }) }] },
        { type: 'text', text: '.' },
      ],
    });
  });

  it('parses complex table with headers, merged cells, and formatting', () => {
    const html = `<table><thead><tr><th colspan="2"><p><strong>Header</strong></p></th></tr></thead><tbody><tr><td rowspan="2"><p>Spans rows</p></td><td><p>Normal</p></td></tr><tr><td><p><a href="https://example.com">Link in cell</a></p></td></tr></tbody></table>`;
    const document = htmlToStoryblokRichtext(html);
    expect(document).toEqual(
      doc({
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [{
              type: 'tableHeader',
              attrs: { colspan: 2, rowspan: 1, colwidth: null },
              content: [{ type: 'paragraph', attrs: { textAlign: null }, content: [{ type: 'text', text: 'Header', marks: [{ type: 'bold' }] }] }],
            }],
          },
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                attrs: { rowspan: 2, colspan: 1, colwidth: null, backgroundColor: null },
                content: [{ type: 'paragraph', attrs: { textAlign: null }, content: [{ type: 'text', text: 'Spans rows' }] }],
              },
              {
                type: 'tableCell',
                attrs: { rowspan: 1, colspan: 1, colwidth: null, backgroundColor: null },
                content: [{ type: 'paragraph', attrs: { textAlign: null }, content: [{ type: 'text', text: 'Normal' }] }],
              },
            ],
          },
          {
            type: 'tableRow',
            content: [{
              type: 'tableCell',
              attrs: { rowspan: 1, colspan: 1, colwidth: null, backgroundColor: null },
              content: [{ type: 'paragraph', attrs: { textAlign: null }, content: [{ type: 'text', text: 'Link in cell', marks: [{ type: 'link', attrs: expect.objectContaining({ href: 'https://example.com' }) }] }] }],
            }],
          },
        ],
      }),
    );
    expect(renderRichText(document)).toBe(html);
  });
});

// ============================================================================
// Tests: Custom Extensions
// ============================================================================

describe('hTML → Richtext (strict): Custom parsers', () => {
  it('parses emoji with custom extension', () => {
    const html = '<div data-type="emoji" data-test="rocket" data-emoji="🚀"><img src="https://cdn.example.com/rocket.png" alt="🚀"></div>';
    const result = htmlToStoryblokRichtext(html, {
      parsers: {
        emoji: {
          parseHTML: () => [{ tag: 'div[data-type="emoji"]' }],
          attributeParsers: {
            name: mapToAttribute(['data-test', 'data-name']),
            emoji: mapToAttribute('data-emoji'),
            fallbackImage: (el) => {
              const img = el.querySelector('img');
              return img ? img.getAttribute('src')! : null;
            },
          },
        },
      },
    });
    expect(result).toEqual(doc({
      type: 'paragraph',
      attrs: { textAlign: null },
      content: [{
        type: 'emoji',
        attrs: {
          name: 'rocket',
          emoji: '🚀',
          fallbackImage: 'https://cdn.example.com/rocket.png',
        },
      }],
    }));
  });

  it('parses code block with custom language extraction', () => {
    const html = '<pre><code class="language-typescript">const greeting: string = "Hello";</code></pre>';
    const result = htmlToStoryblokRichtext(html, {
      parsers: {
        code_block: {
          attributeParsers: {
            class: (el) => {
              const codeEl = el.querySelector('code');
              const className = codeEl?.getAttribute('class') || '';
              const match = className.match(/(?:language|lang)-(\w+)/);
              return match ? match[1] : null;
            },
          },
        },
      },
    });
    expect(result).toEqual(doc({
      type: 'code_block',
      attrs: { class: 'typescript' },
      content: [{ type: 'text', text: 'const greeting: string = "Hello";' }],
    }));
  });

  it('parses image with custom meta_data extraction', () => {
    const html = `<img 
      src="https://a.storyblok.com/f/12345/800x600/image.jpg" 
      alt="A beautiful landscape" 
      title="Mountain View"
      data-source="Unsplash"
      data-copyright="© 2024 Photographer Name"
    >`;
    const result = htmlToStoryblokRichtext(html, {
      parsers: {
        image: {
          attributeParsers: {
            source: mapToAttribute('data-source'),
            copyright: mapToAttribute('data-copyright'),
            meta_data: el => ({
              alt: mapToAttribute('alt')(el),
              title: el.getAttribute('title'),
              source: el.getAttribute('data-source'),
              copyright: el.getAttribute('data-copyright'),
            }),
          },
        },
      },
    });
    expect(result).toEqual(doc({
      type: 'image',
      attrs: {
        id: null,
        src: 'https://a.storyblok.com/f/12345/800x600/image.jpg',
        alt: 'A beautiful landscape',
        title: 'Mountain View',
        source: 'Unsplash',
        copyright: '© 2024 Photographer Name',
        meta_data: {
          alt: 'A beautiful landscape',
          title: 'Mountain View',
          source: 'Unsplash',
          copyright: '© 2024 Photographer Name',
        },
      },
    }));
  });
});
