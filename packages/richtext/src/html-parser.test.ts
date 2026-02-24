import { describe, expect, it, vi } from 'vitest';
import { htmlToStoryblokRichtext } from './html-parser';
import { richTextResolver } from './richtext';
import { Mark, Node } from '@tiptap/core';
import Heading from '@tiptap/extension-heading';
import Link from '@tiptap/extension-link';

// ── Nodes ──────────────────────────────────────────────────────────────────

describe('hTML → Richtext: Nodes', () => {
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
    it('allows overriding a node extension for parsing', () => {
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

    it('allows overriding a mark extension for parsing', () => {
      const html = '<p><a href="/about" data-linktype="story" data-uuid="abc-123">About</a></p>';
      const CustomLink = Link.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            href: { parseHTML: (el: HTMLElement) => el.getAttribute('href') },
            linktype: {
              default: 'url',
              parseHTML: (el: HTMLElement) => el.getAttribute('data-linktype') || 'url',
            },
            uuid: {
              default: null,
              parseHTML: (el: HTMLElement) => el.getAttribute('data-uuid') || null,
            },
            customParsed: {
              default: false,
              parseHTML: () => true,
            },
          };
        },
      });

      const result = htmlToStoryblokRichtext(html, {
        tiptapExtensions: { link: CustomLink },
      });

      const linkText = result.content[0].content[0];
      expect(linkText.marks[0].attrs).toMatchObject({
        href: '/about',
        linktype: 'story',
        uuid: 'abc-123',
        customParsed: true,
      });
    });

    it('allows adding a completely new node type', () => {
      const Callout = Node.create({
        name: 'callout',
        group: 'block',
        content: 'inline*',
        parseHTML() {
          return [{ tag: 'div[data-callout]' }];
        },
        renderHTML() {
          return ['div', { 'data-callout': '' }, 0];
        },
      });

      const html = '<div data-callout>This is a callout</div>';
      const result = htmlToStoryblokRichtext(html, {
        tiptapExtensions: { callout: Callout },
      });

      expect(result.content[0]).toMatchObject({
        type: 'callout',
        content: [{ type: 'text', text: 'This is a callout' }],
      });
    });
  });
});

// ── Roundtrip: HTML → Richtext → HTML ─────────────────────────────────────
//
// Tests that custom tiptapExtensions work in both directions:
// the same extension defines parseHTML (for the parser) and
// renderHTML (for the renderer).

describe('roundtrip: HTML → Richtext → HTML', () => {
  it('roundtrips a custom heading extension', () => {
    const CustomHeading = Heading.extend({
      renderHTML({ node, HTMLAttributes }) {
        const { level, ...rest } = HTMLAttributes;
        return [`h${node.attrs.level}`, { class: 'custom', ...rest }, 0];
      },
    });

    const html = '<h2>Hello World</h2>';
    const extensions = { heading: CustomHeading };

    // Parse: HTML → JSON
    const json = htmlToStoryblokRichtext(html, { tiptapExtensions: extensions });
    expect(json.content[0]).toMatchObject({
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Hello World' }],
    });

    // Render: JSON → HTML (uses the custom renderHTML)
    const output = richTextResolver({ tiptapExtensions: extensions }).render(json);
    expect(output).toBe('<h2 class="custom">Hello World</h2>');
  });

  it('roundtrips a custom link mark extension', () => {
    const CustomLink = Link.extend({
      addAttributes() {
        return {
          href: { parseHTML: (el: HTMLElement) => el.getAttribute('href') },
          target: { parseHTML: (el: HTMLElement) => el.getAttribute('target') || null },
          linktype: {
            default: 'url',
            parseHTML: (el: HTMLElement) => el.getAttribute('data-linktype') || 'url',
          },
        };
      },
      renderHTML({ HTMLAttributes }) {
        if (HTMLAttributes.linktype === 'story') {
          return ['a', { href: HTMLAttributes.href, class: 'internal-link' }, 0];
        }
        return ['a', { href: HTMLAttributes.href, target: HTMLAttributes.target }, 0];
      },
    });

    const extensions = { link: CustomLink };

    // Parse: HTML → JSON (story link with data-linktype)
    const storyHtml = '<p><a href="/about" data-linktype="story">About</a></p>';
    const storyJson = htmlToStoryblokRichtext(storyHtml, { tiptapExtensions: extensions });
    expect(storyJson.content[0].content[0].marks[0].attrs).toMatchObject({
      href: '/about',
      linktype: 'story',
    });

    // Render: JSON → HTML (story link gets class="internal-link")
    const storyOutput = richTextResolver({ tiptapExtensions: extensions }).render(storyJson);
    expect(storyOutput).toBe('<p><a href="/about" class="internal-link">About</a></p>');

    // Parse + render: external link
    const extHtml = '<p><a href="https://example.com" target="_blank">Example</a></p>';
    const extJson = htmlToStoryblokRichtext(extHtml, { tiptapExtensions: extensions });
    const extOutput = richTextResolver({ tiptapExtensions: extensions }).render(extJson);
    expect(extOutput).toBe('<p><a href="https://example.com" target="_blank">Example</a></p>');
  });

  it('roundtrips a completely new node type', () => {
    const Callout = Node.create({
      name: 'callout',
      group: 'block',
      content: 'inline*',
      addAttributes() {
        return {
          type: {
            default: 'info',
            parseHTML: (el: HTMLElement) => el.getAttribute('data-type') || 'info',
          },
        };
      },
      parseHTML() {
        return [{ tag: 'div[data-callout]' }];
      },
      renderHTML({ HTMLAttributes }) {
        return ['div', { 'data-callout': '', 'data-type': HTMLAttributes.type, 'class': `callout-${HTMLAttributes.type}` }, 0];
      },
    });

    const extensions = { callout: Callout };

    // Parse: HTML → JSON
    const html = '<div data-callout data-type="warning">Watch out!</div>';
    const json = htmlToStoryblokRichtext(html, { tiptapExtensions: extensions });
    expect(json.content[0]).toMatchObject({
      type: 'callout',
      attrs: { type: 'warning' },
      content: [{ type: 'text', text: 'Watch out!' }],
    });

    // Render: JSON → HTML
    const output = richTextResolver({ tiptapExtensions: extensions }).render(json);
    expect(output).toBe('<div data-callout="" data-type="warning" class="callout-warning">Watch out!</div>');
  });

  it('roundtrips a custom mark with extra attributes', () => {
    const CustomHighlight = Mark.create({
      name: 'highlight',
      addAttributes() {
        return {
          color: {
            default: 'yellow',
            parseHTML: (el: HTMLElement) => el.getAttribute('data-color') || 'yellow',
          },
        };
      },
      parseHTML() {
        return [{ tag: 'mark' }];
      },
      renderHTML({ HTMLAttributes }) {
        return ['mark', { 'data-color': HTMLAttributes.color, 'style': `background-color: ${HTMLAttributes.color}` }, 0];
      },
    });

    const extensions = { highlight: CustomHighlight };

    // Parse: HTML → JSON
    const html = '<p><mark data-color="pink">Important</mark></p>';
    const json = htmlToStoryblokRichtext(html, { tiptapExtensions: extensions });
    expect(json.content[0].content[0]).toMatchObject({
      type: 'text',
      text: 'Important',
      marks: [{ type: 'highlight', attrs: { color: 'pink' } }],
    });

    // Render: JSON → HTML
    const output = richTextResolver({ tiptapExtensions: extensions }).render(json);
    expect(output).toBe('<p><mark data-color="pink" style="background-color: pink">Important</mark></p>');
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
});
