import { describe, expect, it, vi } from 'vitest';
import { htmlToStoryblokRichtext } from './html-parser';
import Heading from '@tiptap/extension-heading';

// ── Nodes ──────────────────────────────────────────────────────────────────

describe('hTML → Richtext: Nodes', () => {
  describe('heading', () => {
    it('parses all heading levels (h1–h6)', () => {
      const html = '<h1>H1</h1><h2>H2</h2><h3>H3</h3><h4>H4</h4><h5>H5</h5><h6>H6</h6>';
      const result = htmlToStoryblokRichtext(html);
      expect(result.content).toHaveLength(6);
      for (let i = 0; i < 6; i++) {
        expect(result.content[i]).toMatchObject({
          type: 'heading',
          attrs: { level: i + 1 },
          content: [{ type: 'text', text: `H${i + 1}` }],
        });
      }
    });

    it('parses heading with inline marks', () => {
      const html = '<h2><strong>Bold</strong> and <em>italic</em> heading</h2>';
      const result = htmlToStoryblokRichtext(html);
      expect(result.content[0]).toMatchObject({
        type: 'heading',
        attrs: { level: 2 },
        content: [
          { type: 'text', text: 'Bold', marks: [{ type: 'bold' }] },
          { type: 'text', text: ' and ' },
          { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
          { type: 'text', text: ' heading' },
        ],
      });
    });
  });

  describe('paragraph', () => {
    it('parses a plain paragraph', () => {
      const result = htmlToStoryblokRichtext('<p>Hello world.</p>');
      expect(result.content[0]).toMatchObject({
        type: 'paragraph',
        content: [{ type: 'text', text: 'Hello world.' }],
      });
    });

    it('parses multiple paragraphs', () => {
      const result = htmlToStoryblokRichtext('<p>First</p><p>Second</p><p>Third</p>');
      expect(result.content).toHaveLength(3);
      expect(result.content[0].content[0]).toMatchObject({ text: 'First' });
      expect(result.content[1].content[0]).toMatchObject({ text: 'Second' });
      expect(result.content[2].content[0]).toMatchObject({ text: 'Third' });
    });

    it('parses an empty paragraph', () => {
      const result = htmlToStoryblokRichtext('<p></p>');
      expect(result.content[0]).toMatchObject({ type: 'paragraph' });
    });
  });

  describe('blockquote', () => {
    it('parses a blockquote', () => {
      const result = htmlToStoryblokRichtext('<blockquote>Quoted text.</blockquote>');
      expect(result.content[0]).toMatchObject({
        type: 'blockquote',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Quoted text.' }] },
        ],
      });
    });

    it('parses a blockquote with nested formatting', () => {
      const result = htmlToStoryblokRichtext('<blockquote><p><strong>Bold</strong> in a quote.</p></blockquote>');
      expect(result.content[0]).toMatchObject({
        type: 'blockquote',
        content: [{
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Bold', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' in a quote.' },
          ],
        }],
      });
    });

    it('parses nested blockquotes', () => {
      const result = htmlToStoryblokRichtext('<blockquote><blockquote>Nested quote</blockquote></blockquote>');
      expect(result.content[0]).toMatchObject({
        type: 'blockquote',
        content: [{
          type: 'blockquote',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nested quote' }] }],
        }],
      });
    });
  });

  describe('bullet_list', () => {
    it('parses a bullet list', () => {
      const result = htmlToStoryblokRichtext('<ul><li>A</li><li>B</li></ul>');
      expect(result.content[0]).toMatchObject({
        type: 'bullet_list',
        content: [
          { type: 'list_item', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A' }] }] },
          { type: 'list_item', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'B' }] }] },
        ],
      });
    });

    it('parses a nested bullet list', () => {
      const result = htmlToStoryblokRichtext('<ul><li>Parent<ul><li>Child</li></ul></li></ul>');
      expect(result.content[0]).toMatchObject({
        type: 'bullet_list',
        content: [{
          type: 'list_item',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Parent' }] },
            {
              type: 'bullet_list',
              content: [
                { type: 'list_item', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Child' }] }] },
              ],
            },
          ],
        }],
      });
    });

    it('parses list items with marks', () => {
      const result = htmlToStoryblokRichtext('<ul><li><strong>Bold item</strong></li><li><em>Italic item</em></li></ul>');
      expect(result.content[0].content[0]).toMatchObject({
        type: 'list_item',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bold item', marks: [{ type: 'bold' }] }] }],
      });
      expect(result.content[0].content[1]).toMatchObject({
        type: 'list_item',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Italic item', marks: [{ type: 'italic' }] }] }],
      });
    });
  });

  describe('ordered_list', () => {
    it('parses an ordered list', () => {
      const result = htmlToStoryblokRichtext('<ol><li>First</li><li>Second</li></ol>');
      expect(result.content[0]).toMatchObject({
        type: 'ordered_list',
        content: [
          { type: 'list_item', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First' }] }] },
          { type: 'list_item', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second' }] }] },
        ],
      });
    });

    it('parses a nested ordered list', () => {
      const result = htmlToStoryblokRichtext('<ol><li>Parent<ol><li>Child</li></ol></li></ol>');
      expect(result.content[0]).toMatchObject({
        type: 'ordered_list',
        content: [{
          type: 'list_item',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Parent' }] },
            {
              type: 'ordered_list',
              content: [
                { type: 'list_item', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Child' }] }] },
              ],
            },
          ],
        }],
      });
    });

    it('parses mixed nested lists (ordered inside bullet)', () => {
      const result = htmlToStoryblokRichtext('<ul><li>Bullet<ol><li>Ordered</li></ol></li></ul>');
      expect(result.content[0]).toMatchObject({
        type: 'bullet_list',
        content: [{
          type: 'list_item',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Bullet' }] },
            {
              type: 'ordered_list',
              content: [
                { type: 'list_item', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ordered' }] }] },
              ],
            },
          ],
        }],
      });
    });
  });

  describe('code_block', () => {
    it('parses a code block with language', () => {
      const result = htmlToStoryblokRichtext('<pre><code class="language-typescript">const x: number = 1;</code></pre>');
      expect(result.content[0]).toMatchObject({
        type: 'code_block',
        attrs: { language: 'typescript' },
        content: [{ type: 'text', text: 'const x: number = 1;' }],
      });
    });

    it('parses a code block without language', () => {
      const result = htmlToStoryblokRichtext('<pre><code>plain code</code></pre>');
      expect(result.content[0]).toMatchObject({
        type: 'code_block',
        content: [{ type: 'text', text: 'plain code' }],
      });
    });

    it('preserves newlines inside code blocks', () => {
      const result = htmlToStoryblokRichtext('<pre><code>line 1\nline 2\nline 3</code></pre>');
      expect(result.content[0].content[0].text).toBe('line 1\nline 2\nline 3');
    });

    it('parses a bare pre tag as code_block', () => {
      const result = htmlToStoryblokRichtext('<pre>bare pre</pre>');
      expect(result.content[0]).toMatchObject({
        type: 'code_block',
        content: [{ type: 'text', text: 'bare pre' }],
      });
    });

    it('does not warn for valid code blocks with language class', () => {
      const warn = vi.spyOn(console, 'warn');
      const html = '<pre><code class="language-js">const foo = "bar";\nconsole.log(foo);\n</code></pre>';
      const result = htmlToStoryblokRichtext(html);
      expect(warn).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        type: 'doc',
        content: [{
          type: 'code_block',
          attrs: { language: 'js' },
          content: [{ type: 'text', text: 'const foo = "bar";\nconsole.log(foo);\n' }],
        }],
      });
    });
  });

  describe('horizontal_rule', () => {
    it('parses <hr>', () => {
      const result = htmlToStoryblokRichtext('<p>Above</p><hr><p>Below</p>');
      expect(result.content[1]).toMatchObject({ type: 'horizontal_rule' });
    });

    it('parses self-closing <hr />', () => {
      const result = htmlToStoryblokRichtext('<hr />');
      expect(result.content[0]).toMatchObject({ type: 'horizontal_rule' });
    });
  });

  describe('hard_break', () => {
    it('parses <br> inside a paragraph', () => {
      const result = htmlToStoryblokRichtext('<p>Line 1<br>Line 2</p>');
      expect(result.content[0]).toMatchObject({
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Line 1' },
          { type: 'hard_break' },
          { type: 'text', text: 'Line 2' },
        ],
      });
    });

    it('parses multiple <br> tags', () => {
      const result = htmlToStoryblokRichtext('<p>A<br>B<br>C</p>');
      expect(result.content[0].content).toHaveLength(5);
      expect(result.content[0].content[1]).toMatchObject({ type: 'hard_break' });
      expect(result.content[0].content[3]).toMatchObject({ type: 'hard_break' });
    });
  });

  describe('image', () => {
    it('parses an image with all attributes', () => {
      const result = htmlToStoryblokRichtext('<img src="https://example.com/img.jpg" alt="Alt text" title="Title text">');
      expect(result.content[0]).toMatchObject({
        type: 'image',
        attrs: {
          src: 'https://example.com/img.jpg',
          alt: 'Alt text',
          title: 'Title text',
        },
      });
    });

    it('parses an image with only src', () => {
      const result = htmlToStoryblokRichtext('<img src="https://example.com/img.png">');
      expect(result.content[0]).toMatchObject({
        type: 'image',
        attrs: { src: 'https://example.com/img.png' },
      });
    });
  });

  describe('emoji', () => {
    it('parses an emoji span', () => {
      const html = '<span data-type="emoji" data-name="rocket" data-emoji="🚀"><img src="https://cdn.example.com/rocket.png" alt="🚀"></span>';
      const result = htmlToStoryblokRichtext(html);
      expect(result.content[0]).toMatchObject({
        type: 'paragraph',
        content: [{
          type: 'emoji',
          attrs: {
            name: 'rocket',
          },
        }],
      });
    });
  });

  describe('table', () => {
    it('parses a basic table with headers and cells', () => {
      const html = '<table><thead><tr><th>H1</th><th>H2</th></tr></thead><tbody><tr><td>C1</td><td>C2</td></tr></tbody></table>';
      const result = htmlToStoryblokRichtext(html);
      expect(result.content[0]).toMatchObject({
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

    it('parses table cells with colspan and rowspan', () => {
      const html = '<table><tbody><tr><td colspan="2">Span 2 cols</td></tr><tr><td rowspan="2">Span 2 rows</td><td>Normal</td></tr></tbody></table>';
      const result = htmlToStoryblokRichtext(html);
      const firstRow = result.content[0].content[0];
      expect(firstRow.content[0].attrs).toMatchObject({ colspan: 2 });
      const secondRow = result.content[0].content[1];
      expect(secondRow.content[0].attrs).toMatchObject({ rowspan: 2 });
    });

    it('parses table cells with marks inside', () => {
      const html = '<table><tbody><tr><td><strong>Bold cell</strong></td><td><em>Italic cell</em></td></tr></tbody></table>';
      const result = htmlToStoryblokRichtext(html);
      const row = result.content[0].content[0];
      expect(row.content[0].content[0].content[0]).toMatchObject({ type: 'text', text: 'Bold cell', marks: [{ type: 'bold' }] });
      expect(row.content[1].content[0].content[0]).toMatchObject({ type: 'text', text: 'Italic cell', marks: [{ type: 'italic' }] });
    });

    it('parses a table without thead (body-only)', () => {
      const html = '<table><tbody><tr><td>A</td><td>B</td></tr></tbody></table>';
      const result = htmlToStoryblokRichtext(html);
      expect(result.content[0]).toMatchObject({
        type: 'table',
        content: [{
          type: 'tableRow',
          content: [
            { type: 'tableCell' },
            { type: 'tableCell' },
          ],
        }],
      });
    });
  });

  describe('details', () => {
    it('parses a details/summary element', () => {
      const html = '<details><summary>Click to expand</summary><p>Hidden content</p></details>';
      const result = htmlToStoryblokRichtext(html);
      expect(result.content[0]).toMatchObject({
        type: 'details',
        content: [
          { type: 'detailsSummary', content: [{ type: 'text', text: 'Click to expand' }] },
          { type: 'detailsContent', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hidden content' }] }] },
        ],
      });
    });
  });
});

// ── Marks ──────────────────────────────────────────────────────────────────

describe('hTML → Richtext: Marks', () => {
  describe('bold', () => {
    it('parses <strong>', () => {
      const result = htmlToStoryblokRichtext('<p><strong>bold</strong></p>');
      expect(result.content[0].content[0]).toMatchObject({ type: 'text', text: 'bold', marks: [{ type: 'bold' }] });
    });

    it('parses <b>', () => {
      const result = htmlToStoryblokRichtext('<p><b>bold</b></p>');
      expect(result.content[0].content[0]).toMatchObject({ type: 'text', text: 'bold', marks: [{ type: 'bold' }] });
    });
  });

  describe('italic', () => {
    it('parses <em>', () => {
      const result = htmlToStoryblokRichtext('<p><em>italic</em></p>');
      expect(result.content[0].content[0]).toMatchObject({ type: 'text', text: 'italic', marks: [{ type: 'italic' }] });
    });

    it('parses <i>', () => {
      const result = htmlToStoryblokRichtext('<p><i>italic</i></p>');
      expect(result.content[0].content[0]).toMatchObject({ type: 'text', text: 'italic', marks: [{ type: 'italic' }] });
    });
  });

  describe('underline', () => {
    it('parses <u>', () => {
      const result = htmlToStoryblokRichtext('<p><u>underlined</u></p>');
      expect(result.content[0].content[0]).toMatchObject({ type: 'text', text: 'underlined', marks: [{ type: 'underline' }] });
    });
  });

  describe('strike', () => {
    it('parses <s>', () => {
      const result = htmlToStoryblokRichtext('<p><s>struck</s></p>');
      expect(result.content[0].content[0]).toMatchObject({ type: 'text', text: 'struck', marks: [{ type: 'strike' }] });
    });

    it('parses <del>', () => {
      const result = htmlToStoryblokRichtext('<p><del>deleted</del></p>');
      expect(result.content[0].content[0]).toMatchObject({ type: 'text', text: 'deleted', marks: [{ type: 'strike' }] });
    });

    it('parses <strike>', () => {
      const result = htmlToStoryblokRichtext('<p><strike>struck</strike></p>');
      expect(result.content[0].content[0]).toMatchObject({ type: 'text', text: 'struck', marks: [{ type: 'strike' }] });
    });
  });

  describe('code', () => {
    it('parses inline <code>', () => {
      const result = htmlToStoryblokRichtext('<p>Use <code>const</code> keyword</p>');
      expect(result.content[0].content[1]).toMatchObject({ type: 'text', text: 'const', marks: [{ type: 'code' }] });
    });
  });

  describe('superscript', () => {
    it('parses <sup>', () => {
      const result = htmlToStoryblokRichtext('<p>E=mc<sup>2</sup></p>');
      expect(result.content[0].content[1]).toMatchObject({ type: 'text', text: '2', marks: [{ type: 'superscript' }] });
    });
  });

  describe('subscript', () => {
    it('parses <sub>', () => {
      const result = htmlToStoryblokRichtext('<p>H<sub>2</sub>O</p>');
      expect(result.content[0].content[1]).toMatchObject({ type: 'text', text: '2', marks: [{ type: 'subscript' }] });
    });
  });

  describe('highlight', () => {
    it('parses <mark>', () => {
      const result = htmlToStoryblokRichtext('<p><mark>highlighted</mark></p>');
      expect(result.content[0].content[0]).toMatchObject({
        type: 'text',
        text: 'highlighted',
        marks: [{ type: 'highlight' }],
      });
    });
  });

  describe('link', () => {
    it('parses a simple URL link', () => {
      const result = htmlToStoryblokRichtext('<p><a href="https://example.com">Click here</a></p>');
      expect(result.content[0].content[0]).toMatchObject({
        type: 'text',
        text: 'Click here',
        marks: [{
          type: 'link',
          attrs: { href: 'https://example.com', linktype: 'url' },
        }],
      });
    });

    it('parses a link with target="_blank"', () => {
      const result = htmlToStoryblokRichtext('<p><a href="https://example.com" target="_blank">New tab</a></p>');
      expect(result.content[0].content[0].marks[0].attrs).toMatchObject({
        href: 'https://example.com',
        target: '_blank',
        linktype: 'url',
      });
    });

    it('parses a story link with data-uuid and data-linktype', () => {
      const result = htmlToStoryblokRichtext('<p><a href="/about" data-uuid="abc-123" data-linktype="story">About</a></p>');
      expect(result.content[0].content[0].marks[0].attrs).toMatchObject({
        href: '/about',
        uuid: 'abc-123',
        linktype: 'story',
      });
    });

    it('parses a story link with data-anchor', () => {
      const result = htmlToStoryblokRichtext('<p><a href="/page" data-uuid="uuid-1" data-anchor="section" data-linktype="story">Link</a></p>');
      expect(result.content[0].content[0].marks[0].attrs).toMatchObject({
        href: '/page',
        uuid: 'uuid-1',
        anchor: 'section',
        linktype: 'story',
      });
    });

    it('parses an email link', () => {
      const result = htmlToStoryblokRichtext('<p><a href="mailto:info@example.com" data-linktype="email">Email us</a></p>');
      expect(result.content[0].content[0].marks[0].attrs).toMatchObject({
        href: 'mailto:info@example.com',
        linktype: 'email',
      });
    });

    it('parses an asset link', () => {
      const result = htmlToStoryblokRichtext('<p><a href="https://a.storyblok.com/f/000/doc.pdf" data-linktype="asset">Download</a></p>');
      expect(result.content[0].content[0].marks[0].attrs).toMatchObject({
        href: 'https://a.storyblok.com/f/000/doc.pdf',
        linktype: 'asset',
      });
    });

    it('defaults linktype to "url" when no data-linktype', () => {
      const result = htmlToStoryblokRichtext('<p><a href="/path">Link</a></p>');
      expect(result.content[0].content[0].marks[0].attrs.linktype).toBe('url');
    });
  });

  describe('anchor', () => {
    it('parses <span id="..."> as anchor mark', () => {
      const result = htmlToStoryblokRichtext('<p><span id="my-anchor">Anchored text</span></p>');
      const marks = result.content[0].content[0].marks;
      const anchorMark = marks?.find((m: any) => m.type === 'anchor');
      expect(anchorMark).toMatchObject({ type: 'anchor', attrs: { id: 'my-anchor' } });
    });
  });
});

// ── Combined Marks ─────────────────────────────────────────────────────────

describe('hTML → Richtext: Combined marks', () => {
  it('parses bold + italic', () => {
    const result = htmlToStoryblokRichtext('<p><strong><em>bold italic</em></strong></p>');
    expect(result.content[0].content[0]).toMatchObject({
      type: 'text',
      text: 'bold italic',
      marks: [{ type: 'bold' }, { type: 'italic' }],
    });
  });

  it('parses bold + italic + underline', () => {
    const result = htmlToStoryblokRichtext('<p><strong><em><u>bold italic underline</u></em></strong></p>');
    const marks = result.content[0].content[0].marks;
    expect(marks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'bold' }),
        expect.objectContaining({ type: 'italic' }),
        expect.objectContaining({ type: 'underline' }),
      ]),
    );
  });

  it('parses bold link', () => {
    const result = htmlToStoryblokRichtext('<p><a href="https://example.com"><strong>bold link</strong></a></p>');
    const marks = result.content[0].content[0].marks;
    expect(marks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'link' }),
        expect.objectContaining({ type: 'bold' }),
      ]),
    );
  });

  it('parses italic link', () => {
    const result = htmlToStoryblokRichtext('<p><em><a href="https://example.com">italic link</a></em></p>');
    const marks = result.content[0].content[0].marks;
    expect(marks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'link' }),
        expect.objectContaining({ type: 'italic' }),
      ]),
    );
  });

  it('parses link with mixed bold and italic segments', () => {
    const result = htmlToStoryblokRichtext('<p><a href="https://example.com"><strong>bold</strong> and <em>italic</em></a></p>');
    const content = result.content[0].content;
    expect(content).toHaveLength(3);
    expect(content[0]).toMatchObject({
      type: 'text',
      text: 'bold',
      marks: expect.arrayContaining([
        expect.objectContaining({ type: 'link' }),
        expect.objectContaining({ type: 'bold' }),
      ]),
    });
    expect(content[1]).toMatchObject({
      type: 'text',
      text: ' and ',
      marks: [expect.objectContaining({ type: 'link' })],
    });
    expect(content[2]).toMatchObject({
      type: 'text',
      text: 'italic',
      marks: expect.arrayContaining([
        expect.objectContaining({ type: 'link' }),
        expect.objectContaining({ type: 'italic' }),
      ]),
    });
  });

  it('handles interleaved bold and italic in the same paragraph', () => {
    const result = htmlToStoryblokRichtext('<p>normal <strong>bold</strong> <em>italic</em> <strong><em>both</em></strong></p>');
    const content = result.content[0].content;
    expect(content[0]).toMatchObject({ type: 'text', text: 'normal ' });
    expect(content[1]).toMatchObject({ type: 'text', text: 'bold', marks: [{ type: 'bold' }] });
    expect(content[2]).toMatchObject({ type: 'text', text: ' ' });
    expect(content[3]).toMatchObject({ type: 'text', text: 'italic', marks: [{ type: 'italic' }] });
    expect(content[4]).toMatchObject({ type: 'text', text: ' ' });
    expect(content[5]).toMatchObject({
      type: 'text',
      text: 'both',
      marks: [{ type: 'bold' }, { type: 'italic' }],
    });
  });

  it('handles all mark nesting permutations with links', () => {
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
            { type: 'text', text: 'bold and italic', marks: [{ type: 'bold' }, { type: 'italic' }] },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'bold and ', marks: [{ type: 'bold' }] },
            { type: 'text', text: 'italic', marks: [{ type: 'bold' }, { type: 'italic' }] },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'italic and bold', marks: [{ type: 'bold' }, { type: 'italic' }] },
          ],
        },
        {
          type: 'paragraph',
          content: [{
            type: 'text',
            marks: [{ type: 'link', attrs: { href: 'https://bold.storyblok.com' } }, { type: 'bold' }],
            text: 'bold link',
          }],
        },
        {
          type: 'paragraph',
          content: [{
            type: 'text',
            marks: [{ type: 'link', attrs: { href: 'https://bold.storyblok.com' } }, { type: 'bold' }],
            text: 'bold link 2',
          }],
        },
        {
          type: 'paragraph',
          content: [{
            type: 'text',
            marks: [{ type: 'link', attrs: { href: 'https://italic.storyblok.com' } }, { type: 'italic' }],
            text: 'italic link',
          }],
        },
        {
          type: 'paragraph',
          content: [{
            type: 'text',
            marks: [{ type: 'link', attrs: { href: 'https://bold-italic.storyblok.com' } }, { type: 'bold' }, { type: 'italic' }],
            text: 'bold and italic link',
          }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [{ type: 'link', attrs: { href: 'https://bold-italic.storyblok.com' } }, { type: 'bold' }],
              text: 'bold ',
            },
            {
              type: 'text',
              marks: [{ type: 'link', attrs: { href: 'https://bold-italic.storyblok.com' } }, { type: 'italic' }],
              text: 'and italic link',
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [{ type: 'link', attrs: { href: 'https://mixed.storyblok.com' } }, { type: 'bold' }],
              text: 'bold',
            },
            {
              type: 'text',
              marks: [{ type: 'link', attrs: { href: 'https://mixed.storyblok.com' } }],
              text: ', normal ',
            },
            {
              type: 'text',
              marks: [{ type: 'link', attrs: { href: 'https://mixed.storyblok.com' } }, { type: 'italic' }],
              text: 'and italic link',
            },
          ],
        },
      ],
    });
  });
});

// ── Whitespace ─────────────────────────────────────────────────────────────

describe('hTML → Richtext: Whitespace handling', () => {
  it('normalizes whitespace between block elements', () => {
    const result = htmlToStoryblokRichtext('<h1>Title</h1>\n\n<p>Paragraph</p>');
    expect(result.content).toHaveLength(2);
    expect(result.content[0]).toMatchObject({ type: 'heading' });
    expect(result.content[1]).toMatchObject({ type: 'paragraph' });
  });

  it('normalizes newlines within paragraphs', () => {
    const result = htmlToStoryblokRichtext('<p>line\none</p>');
    expect(result.content[0].content[0].text).toBe('line one');
  });

  it('preserves whitespace in code blocks', () => {
    const result = htmlToStoryblokRichtext('<pre><code>  indented\n    more\n</code></pre>');
    expect(result.content[0].content[0].text).toBe('  indented\n    more\n');
  });

  it('preserves whitespace in full mode', () => {
    const result = htmlToStoryblokRichtext('<p>line\none</p>', { preserveWhitespace: 'full' });
    expect(result.content[0].content[0].text).toBe('line\none');
  });

  it('normalizes newlines between adjacent bold marks and around \\r\\n', () => {
    const html = '<h2>Heading</h2>\n<p>paragraph\n1</p>\r\n<p>paragraph 2</p><p><strong>paragraph</strong>\n<strong>2</strong></p>\n<hr />\n<pre>Hello\nworld</pre>';
    const result = htmlToStoryblokRichtext(html);
    expect(result).toMatchObject({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Heading' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'paragraph 1' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'paragraph 2' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'paragraph', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' ' },
            { type: 'text', text: '2', marks: [{ type: 'bold' }] },
          ],
        },
        { type: 'horizontal_rule' },
        { type: 'code_block', attrs: {}, content: [{ type: 'text', text: 'Hello\nworld' }] },
      ],
    });
  });
});

// ── Options & Configuration ────────────────────────────────────────────────

describe('hTML → Richtext: Options & configuration', () => {
  describe('styled mark with styleOptions', () => {
    it('parses <span class="..."> with allowed style class', () => {
      const result = htmlToStoryblokRichtext(
        '<p><span class="highlight-blue">Styled text</span></p>',
        { styleOptions: [{ name: 'Blue Highlight', value: 'highlight-blue' }] },
      );
      expect(result.content[0].content[0]).toMatchObject({
        type: 'text',
        text: 'Styled text',
        marks: [{ type: 'styled', attrs: { class: 'highlight-blue' } }],
      });
    });

    it('ignores unrecognized style classes', () => {
      const result = htmlToStoryblokRichtext(
        '<p><span class="unknown-style">text</span></p>',
        { styleOptions: [{ name: 'Other', value: 'known-style' }] },
      );
      const text = result.content[0].content[0];
      const styledMark = text.marks?.find((m: any) => m.type === 'styled');
      expect(styledMark).toBeUndefined();
    });

    it('extracts only allowed classes from multi-class span', () => {
      const result = htmlToStoryblokRichtext(
        '<p><span class="allowed-1 disallowed">text</span></p>',
        { styleOptions: [{ name: 'Allowed', value: 'allowed-1' }] },
      );
      const text = result.content[0].content[0];
      const styledMark = text.marks?.find((m: any) => m.type === 'styled');
      expect(styledMark).toMatchObject({ type: 'styled', attrs: { class: 'allowed-1' } });
    });

    it('preserves styleOptions on inline elements (exact)', () => {
      const resultStyleOptions = htmlToStoryblokRichtext(
        '<p>foo <span class="style-1 invalid-style">bar</span></p><p>baz <span class="style-2">qux</span></p><p>corge <span class="style-3">grault</span> <a href="/home">Home</a></p>',
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
              { type: 'text', text: 'foo ' },
              { type: 'text', marks: [{ type: 'styled', attrs: { class: 'style-1' } }], text: 'bar' },
            ],
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'baz ' },
              { type: 'text', marks: [{ type: 'styled', attrs: { class: 'style-2' } }], text: 'qux' },
            ],
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'corge grault ' },
              {
                text: 'Home',
                type: 'text',
                marks: [{
                  type: 'link',
                  attrs: { href: '/home', uuid: null, anchor: null, target: null, linktype: 'url' },
                }],
              },
            ],
          },
        ],
      });
    });
  });

  describe('unsupported and custom attributes', () => {
    it('does not preserve unsupported attributes by default (exact)', () => {
      const resultDefault = htmlToStoryblokRichtext(
        '<p class="unsupported">Hello <a data-unsupported-custom-attribute="whatever" target="_blank" href="/home">world!</a></p>',
      );
      expect(resultDefault).toEqual({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { text: 'Hello ', type: 'text' },
              {
                text: 'world!',
                type: 'text',
                marks: [{
                  type: 'link',
                  attrs: { href: '/home', uuid: null, anchor: null, target: '_blank', linktype: 'url' },
                }],
              },
            ],
          },
        ],
      });
    });

    it('preserves custom attributes on <a> when allowCustomAttributes is true (exact)', () => {
      const resultAllowCustomAttributes = htmlToStoryblokRichtext(
        '<p class="unsupported">Hello <a data-supported-custom-attribute="whatever" target="_blank" href="/home">world!</a></p>',
        { allowCustomAttributes: true },
      );
      expect(resultAllowCustomAttributes).toEqual({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { text: 'Hello ', type: 'text' },
              {
                text: 'world!',
                type: 'text',
                marks: [{
                  type: 'link',
                  attrs: {
                    custom: { 'data-supported-custom-attribute': 'whatever' },
                    href: '/home',
                    uuid: null,
                    anchor: null,
                    target: '_blank',
                    linktype: 'url',
                  },
                }],
              },
            ],
          },
        ],
      });
    });
  });

  describe('data loss warnings', () => {
    it('warns the user when transformation leads to data loss', () => {
      const warn = vi.spyOn(console, 'warn');

      const unsupportedAttributes = '<p id="foo" class="unsupported">Hello <a target="_blank" href="/home">world!</a></p>';
      const unsupportedStyles = '<p>Hello <span class="supported unsupported">world!</span></p>';
      htmlToStoryblokRichtext(
        [unsupportedAttributes, unsupportedStyles].join(''),
        { styleOptions: [{ name: 'supported', value: 'supported' }] },
      );

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('[StoryblokRichText] - `id` "foo" on `<p>` can not be transformed to rich text.'));
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('[StoryblokRichText] - `class` "unsupported" on `<p>` can not be transformed to rich text.'));
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('[StoryblokRichText] - `class` "unsupported" on `<span>` can not be transformed to rich text.'));
    });
  });

  describe('custom Tiptap extensions', () => {
    it('allows using custom Tiptap extensions to override parsing', () => {
      const html = '<h2>Custom Heading</h2>';
      const result = htmlToStoryblokRichtext(html, {
        tiptapExtensions: {
          heading: Heading.extend({
            addAttributes() {
              return {
                ...this.parent?.(),
                level: {
                  parseHTML: () => {
                    return 99;
                  },
                },
              };
            },
          }),
        },
      });
      expect(result).toMatchObject({
        type: 'doc',
        content: [{
          type: 'heading',
          attrs: { level: 99 },
          content: [{ type: 'text', text: 'Custom Heading' }],
        }],
      });
    });
  });
});

// ── Reported Issues / Regressions ──────────────────────────────────────────
//
// Tests derived from customer-reported issues.
// These ensure the parser output is compatible with Storyblok's Tiptap editor.

describe('hTML → Richtext: Editor compatibility (reported issues)', () => {
  describe('links must be marks on text nodes, never standalone nodes', () => {
    it('renders links as text nodes with link marks, not as link nodes', () => {
      const result = htmlToStoryblokRichtext('<p>Click <a href="https://example.com">here</a> please.</p>');
      const content = result.content[0].content;
      const linkNode = content[1];
      expect(linkNode.type).toBe('text');
      expect(linkNode.text).toBe('here');
      expect(linkNode.marks).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'link' })]),
      );
      expect(content.every((n: any) => n.type !== 'link')).toBe(true);
    });

    it('renders link inside heading as text with link mark', () => {
      const html = '<h1>Custom Heading with <a href="https://example.com">a link</a>.</h1>';
      const result = htmlToStoryblokRichtext(html);
      expect(result.content[0]).toMatchObject({
        type: 'heading',
        attrs: { level: 1 },
        content: [
          { type: 'text', text: 'Custom Heading with ' },
          {
            type: 'text',
            text: 'a link',
            marks: [{
              type: 'link',
              attrs: expect.objectContaining({ href: 'https://example.com' }),
            }],
          },
          { type: 'text', text: '.' },
        ],
      });
    });
  });

  describe('telephone links', () => {
    it('parses tel: links correctly', () => {
      const result = htmlToStoryblokRichtext('<p><a href="tel:+44 3457 911 911">+44 3457 911 911</a></p>');
      const linkText = result.content[0].content[0];
      expect(linkText).toMatchObject({
        type: 'text',
        text: '+44 3457 911 911',
        marks: [{
          type: 'link',
          attrs: expect.objectContaining({ href: 'tel:+44 3457 911 911' }),
        }],
      });
    });

    it('parses tel: links with target and title attributes', () => {
      const result = htmlToStoryblokRichtext('<p><a href="tel:+44 3457 911 911" target="" title="">+44 3457 911 911</a></p>');
      const linkText = result.content[0].content[0];
      expect(linkText.type).toBe('text');
      expect(linkText.marks[0].type).toBe('link');
      expect(linkText.marks[0].attrs.href).toBe('tel:+44 3457 911 911');
    });
  });

  describe('snake_case vs camelCase node type names', () => {
    it('uses snake_case for list types', () => {
      const result = htmlToStoryblokRichtext('<ul><li>A</li></ul><ol><li>B</li></ol>');
      expect(result.content[0].type).toBe('bullet_list');
      expect(result.content[0].content[0].type).toBe('list_item');
      expect(result.content[1].type).toBe('ordered_list');
      expect(result.content[1].content[0].type).toBe('list_item');
    });

    it('uses snake_case for code_block', () => {
      const result = htmlToStoryblokRichtext('<pre><code>x</code></pre>');
      expect(result.content[0].type).toBe('code_block');
    });

    it('uses snake_case for horizontal_rule', () => {
      const result = htmlToStoryblokRichtext('<hr>');
      expect(result.content[0].type).toBe('horizontal_rule');
    });

    it('uses snake_case for hard_break', () => {
      const result = htmlToStoryblokRichtext('<p>a<br>b</p>');
      expect(result.content[0].content[1].type).toBe('hard_break');
    });

    it('uses camelCase for table types', () => {
      const result = htmlToStoryblokRichtext('<table><thead><tr><th>H</th></tr></thead><tbody><tr><td>C</td></tr></tbody></table>');
      expect(result.content[0].type).toBe('table');
      expect(result.content[0].content[0].type).toBe('tableRow');
      expect(result.content[0].content[0].content[0].type).toBe('tableHeader');
      expect(result.content[0].content[1].content[0].type).toBe('tableCell');
    });
  });

  describe('no stray text nodes between block elements', () => {
    it('does not produce text nodes at the document level', () => {
      const html = `
<h1>Heading</h1>

<p>Paragraph</p>

<ul>
  <li>Item</li>
</ul>

<blockquote>
  <p>Quote</p>
</blockquote>
`;
      const result = htmlToStoryblokRichtext(html);
      for (const node of result.content) {
        expect(node.type).not.toBe('text');
      }
    });

    it('does not produce text nodes between list items', () => {
      const html = `<ul>
  <li>Item 1</li>
  <li>Item 2</li>
  <li>Item 3</li>
</ul>`;
      const result = htmlToStoryblokRichtext(html);
      const list = result.content[0];
      for (const item of list.content) {
        expect(item.type).toBe('list_item');
      }
    });

    it('does not produce text nodes between table rows/cells', () => {
      const html = `<table>
  <thead>
    <tr>
      <th>Header</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Cell</td>
    </tr>
  </tbody>
</table>`;
      const result = htmlToStoryblokRichtext(html);
      const table = result.content[0];
      for (const row of table.content) {
        expect(row.type).toBe('tableRow');
        for (const cell of row.content) {
          expect(['tableCell', 'tableHeader']).toContain(cell.type);
        }
      }
    });
  });

  describe('table support for migrations', () => {
    it('handles a realistic migration table with multiple rows and formatting', () => {
      const html = `<table>
<thead>
  <tr><th>Feature</th><th>Status</th><th>Notes</th></tr>
</thead>
<tbody>
  <tr><td>Authentication</td><td><strong>Complete</strong></td><td>OAuth 2.0</td></tr>
  <tr><td>Dashboard</td><td><em>In Progress</em></td><td>ETA Q2</td></tr>
  <tr><td>API</td><td>Planned</td><td><a href="https://docs.example.com">Docs</a></td></tr>
</tbody>
</table>`;
      const result = htmlToStoryblokRichtext(html);
      const table = result.content[0];
      expect(table.type).toBe('table');
      expect(table.content).toHaveLength(4);

      const headerRow = table.content[0];
      expect(headerRow.content).toHaveLength(3);
      expect(headerRow.content[0]).toMatchObject({ type: 'tableHeader' });
      expect(headerRow.content[0].content[0].content[0].text).toBe('Feature');

      const row1 = table.content[1];
      expect(row1.content[1].content[0].content[0]).toMatchObject({
        type: 'text',
        text: 'Complete',
        marks: [{ type: 'bold' }],
      });

      const row2 = table.content[2];
      expect(row2.content[1].content[0].content[0]).toMatchObject({
        type: 'text',
        text: 'In Progress',
        marks: [{ type: 'italic' }],
      });

      const row3 = table.content[3];
      const linkCell = row3.content[2].content[0].content[0];
      expect(linkCell.type).toBe('text');
      expect(linkCell.text).toBe('Docs');
      expect(linkCell.marks[0].type).toBe('link');
    });
  });

  describe('realistic CMS migration HTML', () => {
    it('handles a full page with mixed content types', () => {
      const html = [
        '<h1>Product Overview</h1>',
        '<p>Welcome to our <strong>product page</strong>. For more details, visit <a href="https://example.com/docs" target="_blank">our documentation</a>.</p>',
        '<h2>Features</h2>',
        '<ul>',
        '  <li>Fast performance with <code>O(1)</code> lookups</li>',
        '  <li>Built-in <em>type safety</em></li>',
        '  <li>Comprehensive API</li>',
        '</ul>',
        '<h2>Pricing</h2>',
        '<table>',
        '  <thead><tr><th>Plan</th><th>Price</th></tr></thead>',
        '  <tbody>',
        '    <tr><td>Free</td><td>$0/mo</td></tr>',
        '    <tr><td>Pro</td><td>$29/mo</td></tr>',
        '  </tbody>',
        '</table>',
        '<h2>Contact</h2>',
        '<p>Email us at <a href="mailto:support@example.com">support@example.com</a> or call <a href="tel:+1-555-0123">+1-555-0123</a>.</p>',
        '<hr>',
        '<blockquote><p>The best product I\'ve ever used! — <em>Customer Review</em></p></blockquote>',
        '<pre><code class="language-bash">npm install @example/product</code></pre>',
      ].join('\n');

      const result = htmlToStoryblokRichtext(html);

      for (const node of result.content) {
        expect(node.type).not.toBe('text');
      }

      const types = result.content.map((n: any) => n.type);
      expect(types).toEqual([
        'heading',
        'paragraph',
        'heading',
        'bullet_list',
        'heading',
        'table',
        'heading',
        'paragraph',
        'horizontal_rule',
        'blockquote',
        'code_block',
      ]);

      const contactParagraph = result.content[7];
      const emailLink = contactParagraph.content.find((n: any) => n.text === 'support@example.com');
      expect(emailLink.marks[0]).toMatchObject({
        type: 'link',
        attrs: expect.objectContaining({ href: 'mailto:support@example.com' }),
      });
      const telLink = contactParagraph.content.find((n: any) => n.text === '+1-555-0123');
      expect(telLink.marks[0]).toMatchObject({
        type: 'link',
        attrs: expect.objectContaining({ href: 'tel:+1-555-0123' }),
      });

      const codeBlock = result.content[10];
      expect(codeBlock).toMatchObject({
        type: 'code_block',
        attrs: { language: 'bash' },
      });
    });
  });
});

// ── Kitchen Sink ───────────────────────────────────────────────────────────

describe('hTML → Richtext: Kitchen sink', () => {
  it('parses a comprehensive HTML document with all node types and marks', () => {
    const html = [
      '<h1>Heading 1</h1>',
      '<h2>Heading 2</h2>',
      '<h3>Heading 3</h3>',
      '<p><strong>bold</strong> <em>italic</em> <u>underline</u> <s>strike</s> <code>code</code> <sup>sup</sup> <sub>sub</sub></p>',
      '<p><mark>highlighted</mark></p>',
      '<p><a href="https://example.com" target="_blank">URL link</a></p>',
      '<p><a href="/about" data-uuid="story-uuid" data-linktype="story">Story link</a></p>',
      '<p><a href="mailto:info@example.com" data-linktype="email">Email link</a></p>',
      '<ul><li>Bullet 1</li><li>Bullet 2<ul><li>Nested</li></ul></li></ul>',
      '<ol><li>Ordered 1</li><li>Ordered 2</li></ol>',
      '<blockquote><p>A quoted paragraph</p></blockquote>',
      '<pre><code class="language-javascript">console.log("hello");</code></pre>',
      '<img src="https://example.com/photo.jpg" alt="Photo" title="A photo">',
      '<hr>',
      '<p>First line<br>Second line</p>',
      '<table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody><tr><td>Key</td><td><strong>Bold value</strong></td></tr></tbody></table>',
      '<p><strong><em><u>triple combo</u></em></strong></p>',
      '<details><summary>Summary</summary><p>Content</p></details>',
    ].join('');

    const result = htmlToStoryblokRichtext(html);

    const types = result.content.map((n: any) => n.type);
    expect(types).toEqual([
      'heading',
      'heading',
      'heading',
      'paragraph',
      'paragraph',
      'paragraph',
      'paragraph',
      'paragraph',
      'bullet_list',
      'ordered_list',
      'blockquote',
      'code_block',
      'image',
      'horizontal_rule',
      'paragraph',
      'table',
      'paragraph',
      'details',
    ]);

    // Spot-check key nodes
    expect(result.content[0]).toMatchObject({ type: 'heading', attrs: { level: 1 } });
    const marksParagraph = result.content[3];
    expect(marksParagraph.content[0]).toMatchObject({ text: 'bold', marks: [{ type: 'bold' }] });
    expect(marksParagraph.content[2]).toMatchObject({ text: 'italic', marks: [{ type: 'italic' }] });
    expect(marksParagraph.content[4]).toMatchObject({ text: 'underline', marks: [{ type: 'underline' }] });
    expect(marksParagraph.content[6]).toMatchObject({ text: 'strike', marks: [{ type: 'strike' }] });
    expect(marksParagraph.content[8]).toMatchObject({ text: 'code', marks: [{ type: 'code' }] });
    expect(marksParagraph.content[10]).toMatchObject({ text: 'sup', marks: [{ type: 'superscript' }] });
    expect(marksParagraph.content[12]).toMatchObject({ text: 'sub', marks: [{ type: 'subscript' }] });
    expect(result.content[4].content[0]).toMatchObject({ text: 'highlighted', marks: [{ type: 'highlight' }] });
    expect(result.content[5].content[0].marks[0]).toMatchObject({ type: 'link', attrs: { href: 'https://example.com', target: '_blank' } });
    expect(result.content[6].content[0].marks[0]).toMatchObject({ type: 'link', attrs: { href: '/about', uuid: 'story-uuid', linktype: 'story' } });
    expect(result.content[7].content[0].marks[0]).toMatchObject({ type: 'link', attrs: { href: 'mailto:info@example.com', linktype: 'email' } });
    expect(result.content[8].content[1].content[1]).toMatchObject({ type: 'bullet_list' });
    expect(result.content[11]).toMatchObject({ type: 'code_block', attrs: { language: 'javascript' } });
    expect(result.content[12]).toMatchObject({ type: 'image', attrs: { src: 'https://example.com/photo.jpg' } });
    expect(result.content[14].content[1]).toMatchObject({ type: 'hard_break' });
    expect(result.content[15].content[0].content[0]).toMatchObject({ type: 'tableHeader' });
    const tripleCombo = result.content[16].content[0];
    expect(tripleCombo.text).toBe('triple combo');
    expect(tripleCombo.marks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'bold' }),
        expect.objectContaining({ type: 'italic' }),
        expect.objectContaining({ type: 'underline' }),
      ]),
    );
    expect(result.content[17]).toMatchObject({ type: 'details' });
    expect(result.content[17].content[0]).toMatchObject({ type: 'detailsSummary' });
    expect(result.content[17].content[1]).toMatchObject({ type: 'detailsContent' });
  });
});
