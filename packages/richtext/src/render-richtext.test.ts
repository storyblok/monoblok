import { describe, expect, it, vi } from 'vitest';
import { renderRichText } from './render-richtext';
import type { SbRichTextDoc, SbRichTextRenderContext } from './static';
import {
  customRendererFixture,
  integrationFixtures,
  linkFixtures,
  linkMark,
  markFixtures,
  nodeFixtures,
  tableFixtures,
  text,
} from './test-utils';
import { attrsToHtmlString, splitTableRows } from './static';

describe('renderRichText', () => {
  describe('input handling', () => {
    it('returns empty string for null input', () => {
      expect(renderRichText(null)).toBe('');
    });
    it('returns empty string for undefined input', () => {
      expect(renderRichText(undefined)).toBe('');
    });
    it('returns empty string for empty array', () => {
      expect(renderRichText([])).toBe('');
    });
  });
  describe('nodes', () => {
    nodeFixtures.forEach(({ title, input, expected }) => {
      it(title, () => {
        const result = renderRichText(input);
        expect(result).toBe(expected);
      });
    });
  });
  describe('tables', () => {
    tableFixtures.forEach(({ title, input, expected }) => {
      it(title, () => {
        const result = renderRichText(input);
        expect(result).toBe(expected);
      });
    });
  });
  describe('marks', () => {
    markFixtures.forEach(({ title, input, expected }) => {
      it(title, () => {
        const result = renderRichText(input);
        expect(result).toBe(expected);
      });
    });
  });
  describe('links', () => {
    linkFixtures.forEach(({ title, input, expected }) => {
      it(title, () => {
        const result = renderRichText(input);
        expect(result).toBe(expected);
      });
    });
  });
  describe('integration', () => {
    integrationFixtures.forEach(({ title, input, expected }) => {
      it(title, () => {
        const result = renderRichText(input);
        expect(result).toBe(expected);
      });
    });
  });
  describe('custom renderers', () => {
    const node_and_mark = customRendererFixture.node_and_mark;
    it(node_and_mark.title, () => {
      const options: SbRichTextRenderContext = {
        renderers: {
          heading: ({ content, attrs, context }) =>
            `<h${attrs?.level} data-type="custom-heading" data-level="${attrs?.level}">${renderRichText(content, context)}</h${attrs?.level}>`,
          bold: ({ children }) => `<b data-type="custom-bold">${children}</b>`,
          link: ({ children, attrs }) =>
            `<a data-type="custom-link" href="${attrs?.href}" target="${attrs?.target}"${attrsToHtmlString(attrs?.custom || {})}>${children}</a>`,
        },
      };
      const result = renderRichText(node_and_mark.input, options);
      expect(result).toBe(node_and_mark.expected);
    });
    const recursive = customRendererFixture.recursive;
    it(recursive.title, () => {
      const options: SbRichTextRenderContext = {
        renderers: {
          heading: ({ attrs, content }) =>
            `<h${attrs?.level} data-type="custom-heading" data-level="${attrs?.level}">${renderRichText(content, options)}</h${attrs?.level}>`,
          bold: ({ children }) => `<b data-type="custom-bold">${children}</b>`,
        },
      };
      expect(renderRichText(recursive.input, options)).toBe(recursive.expected);
    });
    const code_block = customRendererFixture.code_block;
    it(code_block.title, () => {
      const options: SbRichTextRenderContext = {
        renderers: {
          code_block: ({ attrs, content, context }) => {
            const lang = (attrs?.class as string) || '';
            // User decides: class on <pre>, data-lang on <code>
            return `<pre class="language-${lang}"><code data-lang="${lang}">${renderRichText(content, context)}</code></pre>`;
          },
        },
      };
      const html = renderRichText(code_block.input, options);
      expect(html).toBe(code_block.expected);
    });
    const table = customRendererFixture.table;
    it(table.title, () => {
      const options: SbRichTextRenderContext = {
        renderers: {
          table: ({ content, context }) => {
            const { headerRows, bodyRows } = splitTableRows(content);
            return `<table class="custom-table"><thead>${renderRichText(headerRows, context)}</thead><tbody>${renderRichText(bodyRows, context)}</tbody></table>`;
          },
          bold: ({ children }) => `<b data-type="custom-bold">${children}</b>`,
        },
      };
      const html = renderRichText(table.input, options);
      expect(html).toBe(table.expected);
    });
  });
  describe('blok nodes', () => {
    const blokDoc: SbRichTextDoc = {
      type: 'doc',
      content: [
        {
          type: 'blok',
          attrs: {
            id: 'blok-123',
            body: [
              { _uid: '1', component: 'button', title: 'Click Me' },
              { _uid: '2', component: 'button', title: 'Submit' },
            ],
          },
        },
      ],
    };

    it('warns when no custom renderer provided', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      renderRichText(blokDoc);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('blok'));
      warnSpy.mockRestore();
    });

    it('returns empty string without custom renderer', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(renderRichText(blokDoc)).toBe('');
      vi.restoreAllMocks();
    });

    it('renders with custom blok renderer', () => {
      const options: SbRichTextRenderContext = {
        renderers: {
          blok: ({ attrs }) => {
            const body = Array.isArray(attrs?.body) ? attrs.body : [];
            return body
              .map(b => `<button data-uid="${b._uid}">${b.title}</button>`)
              .join('');
          },
        },
      };
      expect(renderRichText(blokDoc, options)).toBe(
        '<button data-uid="1">Click Me</button><button data-uid="2">Submit</button>',
      );
    });

    it('handles empty body', () => {
      const emptyBlok: SbRichTextDoc = {
        type: 'doc',
        content: [{ type: 'blok', attrs: { id: 'x', body: [] } }],
      };
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(renderRichText(emptyBlok)).toBe('');
      vi.restoreAllMocks();
    });

    it('handles null body', () => {
      const nullBlok: SbRichTextDoc = {
        type: 'doc',
        content: [{ type: 'blok', attrs: { id: 'x', body: null } }],
      };
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(renderRichText(nullBlok)).toBe('');
      vi.restoreAllMocks();
    });

    it('works alongside other content', () => {
      const options: SbRichTextRenderContext = {
        renderers: {
          blok: () => '<widget />',
        },
      };
      const content: SbRichTextDoc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { textAlign: null },
            content: [text('Before')],
          },
          {
            type: 'blok',
            attrs: {
              id: 'x',
              body: [{ _uid: '1', component: 'button', title: 'Click Me' }],
            },
          },
          {
            type: 'paragraph',
            attrs: { textAlign: null },
            content: [text('After')],
          },
        ],
      };
      expect(renderRichText(content, options)).toBe(
        '<p>Before</p><widget /><p>After</p>',
      );
    });
  });
  describe('xSS prevention', () => {
    it('escapes HTML in text content', () => {
      const node = text('<script>alert("xss")</script>');
      expect(renderRichText(node)).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
      );
    });

    it('escapes HTML in attributes', () => {
      const node = text('Link', [linkMark('javascript:alert("xss")')]);
      expect(renderRichText(node)).toContain(
        'href="javascript:alert(&quot;xss&quot;)"',
      );
    });
  });
});
