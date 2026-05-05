import { Component, input, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SbRichTextComponent } from './rich-text.component';
import { StoryblokRichtextResolver } from './richtext.feature';
import { SbRichTextDoc } from '@storyblok/richtext/static';

/**
 * Mock custom node component
 */
@Component({
  selector: 'app-custom-paragraph',
  standalone: true,
  imports: [SbRichTextComponent],
  template: `<div class="custom-node">
    <sb-rich-text [sbDocument]="data()?.content" />
  </div>`,
})
class MockCustomParagraphComponent {
  data = input<SbRichTextDoc>();
}

/**
 * Mock custom mark component
 */
@Component({
  selector: 'app-custom-link',
  standalone: true,
  template: `<span class="custom-link"><ng-content /></span>`,
})
class MockCustomMarkComponent {
  data = input<SbRichTextDoc>();
}

/**
 * Creates a mock resolver that matches the StoryblokRichtextResolver interface.
 * By default returns null for all types (native HTML rendering).
 */
function createMockResolver(componentMap: Record<string, Type<unknown>> = {}) {
  const cache = new Map<string, Type<unknown>>();

  return {
    has(key: string): boolean {
      return key in componentMap;
    },
    getSync(key: string): Type<unknown> | null {
      if (cache.has(key)) {
        return cache.get(key)!;
      }
      const entry = componentMap[key];
      if (entry) {
        cache.set(key, entry);
        return entry;
      }
      return null;
    },
    async resolve(key: string): Promise<Type<unknown> | null> {
      if (cache.has(key)) {
        return cache.get(key)!;
      }
      const entry = componentMap[key];
      if (entry) {
        cache.set(key, entry);
        return entry;
      }
      return null;
    },
  };
}
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
  options: {
    target?: '_blank' | '_self';
    linktype?: 'url' | 'story' | 'email' | 'asset';
    anchor?: string;
  } = {},
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

describe('SbRichTextComponent', () => {
  let fixture: ComponentFixture<SbRichTextComponent>;
  let resolver: ReturnType<typeof createMockResolver>;

  beforeEach(async () => {
    resolver = createMockResolver();

    await TestBed.configureTestingModule({
      imports: [SbRichTextComponent],
      providers: [
        {
          provide: StoryblokRichtextResolver,
          useValue: resolver,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SbRichTextComponent);
  });
  describe('input handling', () => {
    it('returns empty string for null input', async () => {
      fixture.componentRef.setInput('sbDocument', null);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const textContent = fixture.nativeElement.textContent.trim();
      expect(textContent).toBe('');
    });

    it('returns empty string for undefined input', async () => {
      fixture.componentRef.setInput('sbDocument', undefined);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const textContent = fixture.nativeElement.textContent.trim();
      expect(textContent).toBe('');
    });

    it('returns empty string for empty array', async () => {
      fixture.componentRef.setInput('sbDocument', []);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const textContent = fixture.nativeElement.textContent.trim();
      expect(textContent).toBe('');
    });

    it('renders array of nodes', async () => {
      const nodes: SbRichTextDoc[] = [
        { type: 'paragraph', content: [text('First')] },
        { type: 'paragraph', content: [text('Second')] },
      ];
      fixture.componentRef.setInput('sbDocument', nodes);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe('<p>First</p><p>Second</p>');
    });

    it('renders doc node without wrapper', async () => {
      const doc: SbRichTextDoc = {
        type: 'doc',
        content: [{ type: 'paragraph', content: [text('Hello')] }],
      };
      fixture.componentRef.setInput('sbDocument', doc);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe('<p>Hello</p>');
    });

    it('renders nested doc nodes', async () => {
      const nested: SbRichTextDoc = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [text('Outer')] },
          { type: 'doc', content: [{ type: 'paragraph', content: [text('Inner')] }] },
        ],
      };
      fixture.componentRef.setInput('sbDocument', nested);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe('<p>Outer</p><p>Inner</p>');
    });

    it('renders single non-doc node directly', async () => {
      const node: SbRichTextDoc = { type: 'paragraph', content: [text('Direct')] };

      fixture.componentRef.setInput('sbDocument', node);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe('<p>Direct</p>');
    });
  });

  // ============================================================================
  // Tests: Block Types
  // ============================================================================

  describe('block types', () => {
    describe('paragraph', () => {
      it('renders basic paragraph', async () => {
        const node: SbRichTextDoc = { type: 'paragraph', content: [text('Hello')] };
        fixture.componentRef.setInput('sbDocument', node);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        const html = fixture.nativeElement.innerHTML.trim();

        expect(html).toBe('<p>Hello</p>');
      });

      it('renders empty paragraph', async () => {
        const node: SbRichTextDoc = { type: 'paragraph', content: [] };
        fixture.componentRef.setInput('sbDocument', node);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        const html = fixture.nativeElement.innerHTML.trim();
        expect(html).toBe('<p></p>');
      });
    });

    describe('heading', () => {
      it.each([1, 2, 3, 4, 5, 6] as const)('renders h%i', async (level) => {
        const heading: SbRichTextDoc = {
          type: 'heading',
          attrs: { level, textAlign: null },
          content: [text(`Heading ${level}`)],
        };
        fixture.componentRef.setInput('sbDocument', heading);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        const html = fixture.nativeElement.innerHTML.trim();

        expect(html).toBe(`<h${level}>Heading ${level}</h${level}>`);
      });
    });

    describe('blockquote', () => {
      it('renders blockquote', async () => {
        const blockquote: SbRichTextDoc = {
          type: 'blockquote',
          content: [{ type: 'paragraph', content: [text('Quote')] }],
        };
        fixture.componentRef.setInput('sbDocument', blockquote);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        const html = fixture.nativeElement.innerHTML.trim();

        expect(html).toBe('<blockquote><p>Quote</p></blockquote>');
      });
    });

    describe('lists', () => {
      it('renders bullet list', async () => {
        const list: SbRichTextDoc = {
          type: 'bullet_list',
          content: [
            { type: 'list_item', content: [{ type: 'paragraph', content: [text('Item 1')] }] },
            { type: 'list_item', content: [{ type: 'paragraph', content: [text('Item 2')] }] },
          ],
        };
        fixture.componentRef.setInput('sbDocument', list);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        const html = fixture.nativeElement.innerHTML.trim();

        expect(html).toBe('<ul><li><p>Item 1</p></li><li><p>Item 2</p></li></ul>');
      });

      it('renders ordered list', async () => {
        const list: SbRichTextDoc = {
          type: 'ordered_list',
          attrs: { order: 1 },
          content: [
            { type: 'list_item', content: [{ type: 'paragraph', content: [text('First')] }] },
            { type: 'list_item', content: [{ type: 'paragraph', content: [text('Second')] }] },
          ],
        };
        fixture.componentRef.setInput('sbDocument', list);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        const html = fixture.nativeElement.innerHTML.trim();

        expect(html).toBe('<ol order="1"><li><p>First</p></li><li><p>Second</p></li></ol>');
      });
    });

    describe('code block', () => {
      it('renders code block with language class', async () => {
        const codeBlock: SbRichTextDoc = {
          type: 'code_block',
          attrs: { class: 'javascript' },
          content: [text('const x = 1;')],
        };
        fixture.componentRef.setInput('sbDocument', codeBlock);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        const html = fixture.nativeElement.innerHTML.trim();

        expect(html).toBe('<pre><code class="javascript">const x = 1;</code></pre>');
      });

      it('does not leak language as attribute', async () => {
        const codeBlock: SbRichTextDoc = {
          type: 'code_block',
          attrs: { class: 'js' },
          content: [text('code')],
        };
        fixture.componentRef.setInput('sbDocument', codeBlock);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        const html = fixture.nativeElement.innerHTML.trim();

        expect(html).not.toContain('language=');
      });
    });

    describe('horizontal rule', () => {
      it('renders hr as self-closing', async () => {
        fixture.componentRef.setInput('sbDocument', { type: 'horizontal_rule' });
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        const html = fixture.nativeElement.innerHTML.trim();

        expect(html).toBe('<hr>');
      });
    });

    describe('hard break', () => {
      it('renders br as self-closing', async () => {
        fixture.componentRef.setInput('sbDocument', { type: 'hard_break' });
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        const html = fixture.nativeElement.innerHTML.trim();

        expect(html).toBe('<br>');
      });
    });

    describe('emoji', () => {
      it('renders emoji as image with fallback', async () => {
        const emoji: SbRichTextDoc = {
          type: 'emoji',
          attrs: {
            emoji: '🚀',
            name: 'rocket',
            fallbackImage: 'https://cdn.example.com/rocket.png',
          },
        };
        fixture.componentRef.setInput('sbDocument', emoji);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        const html = fixture.nativeElement.innerHTML.trim();

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
    it('renders basic table with tbody', async () => {
      const t = table([tableRow([tableCell('A'), tableCell('B')])]);
      fixture.componentRef.setInput('sbDocument', t);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe(
        '<table><tbody><tr><td colspan="1" rowspan="1"><p>A</p></td><td colspan="1" rowspan="1"><p>B</p></td></tr></tbody></table>',
      );
    });

    it('renders table with thead and tbody', async () => {
      const t = table([
        tableRow([tableHeader('H1'), tableHeader('H2')]),
        tableRow([tableCell('C1'), tableCell('C2')]),
      ]);
      fixture.componentRef.setInput('sbDocument', t);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe(
        '<table><thead><tr><th colspan="1" rowspan="1"><p>H1</p></th><th colspan="1" rowspan="1"><p>H2</p></th></tr></thead>' +
          '<tbody><tr><td colspan="1" rowspan="1"><p>C1</p></td><td colspan="1" rowspan="1"><p>C2</p></td></tr></tbody></table>',
      );
    });

    it('renders colspan and rowspan', async () => {
      const t = table([tableRow([tableCell('Merged', { colspan: 2, rowspan: 2 })])]);
      fixture.componentRef.setInput('sbDocument', t);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toContain('colspan="2" rowspan="2"');
    });

    it('renders colwidth as style', async () => {
      const t = table([tableRow([tableCell('Wide', { colwidth: [200] })])]);
      fixture.componentRef.setInput('sbDocument', t);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toContain('style="width: 200px;"');
    });

    it('renders backgroundColor as style', async () => {
      const t = table([tableRow([tableCell('Colored', { backgroundColor: '#FF0000' })])]);
      fixture.componentRef.setInput('sbDocument', t);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toContain('background-color: #FF0000;');
    });

    it('combines multiple styles', async () => {
      const t = table([
        tableRow([tableCell('Styled', { colwidth: [100], backgroundColor: '#00FF00' })]),
      ]);
      fixture.componentRef.setInput('sbDocument', t);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toContain('width: 100px;');
      expect(html).toContain('background-color: #00FF00;');
    });
  });

  // ============================================================================
  // Tests: Marks (Inline Formatting)
  // ============================================================================

  describe('marks', () => {
    it('renders bold', async () => {
      const node = text('Bold', [{ type: 'bold' }]);
      fixture.componentRef.setInput('sbDocument', node);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe('<strong>Bold</strong>');
    });

    it('renders italic', async () => {
      const node = text('Italic', [{ type: 'italic' }]);
      fixture.componentRef.setInput('sbDocument', node);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe('<em>Italic</em>');
    });

    it('renders strike', async () => {
      const node = text('Strike', [{ type: 'strike' }]);
      fixture.componentRef.setInput('sbDocument', node);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe('<s>Strike</s>');
    });

    it('renders underline', async () => {
      const node = text('Underline', [{ type: 'underline' }]);
      fixture.componentRef.setInput('sbDocument', node);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe('<u>Underline</u>');
    });

    it('renders code', async () => {
      const node = text('code', [{ type: 'code' }]);
      fixture.componentRef.setInput('sbDocument', node);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe('<code>code</code>');
    });

    it('renders superscript', async () => {
      const node = text('sup', [{ type: 'superscript' }]);
      fixture.componentRef.setInput('sbDocument', node);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe('<sup>sup</sup>');
    });

    it('renders subscript', async () => {
      const node = text('sub', [{ type: 'subscript' }]);
      fixture.componentRef.setInput('sbDocument', node);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe('<sub>sub</sub>');
    });

    it('renders nested marks', async () => {
      const node = text('Bold Italic', [{ type: 'bold' }, { type: 'italic' }]);
      fixture.componentRef.setInput('sbDocument', node);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe('<em><strong>Bold Italic</strong></em>');
    });

    it('renders anchor mark as span with id', async () => {
      const node = text('Anchored', [{ type: 'anchor', attrs: { id: 'section-1' } }]);
      fixture.componentRef.setInput('sbDocument', node);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe('<span id="section-1">Anchored</span>');
    });

    it('renders styled mark with class', async () => {
      const node = text('Styled', [{ type: 'styled', attrs: { class: 'highlight' } }]);
      fixture.componentRef.setInput('sbDocument', node);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe('<span class="highlight">Styled</span>');
    });

    it('renders textStyle with color', async () => {
      const node = text('Red', [
        { type: 'textStyle', attrs: { color: 'red', id: null, class: null } },
      ]);
      fixture.componentRef.setInput('sbDocument', node);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe('<span style="color: red;">Red</span>');
    });
  });

  // ============================================================================
  // Tests: Links
  // ============================================================================

  describe('links', () => {
    it('renders external URL link', async () => {
      const node = text('Click', [linkMark('https://example.com', { target: '_blank' })]);
      fixture.componentRef.setInput('sbDocument', node);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe('<a href="https://example.com" target="_blank">Click</a>');
    });

    it('renders internal story link', async () => {
      const node = text('Page', [linkMark('/about', { linktype: 'story' })]);
      fixture.componentRef.setInput('sbDocument', node);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe('<a href="/about">Page</a>');
    });

    it('renders story link with anchor', async () => {
      const node = text('Section', [linkMark('/page', { linktype: 'story', anchor: 'intro' })]);
      fixture.componentRef.setInput('sbDocument', node);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe('<a href="/page#intro">Section</a>');
    });

    it('renders email link with mailto:', async () => {
      const node = text('Email', [linkMark('test@example.com', { linktype: 'email' })]);
      fixture.componentRef.setInput('sbDocument', node);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe('<a href="mailto:test@example.com">Email</a>');
    });

    it('does not duplicate mailto: prefix', async () => {
      const node = text('Email', [linkMark('mailto:test@example.com', { linktype: 'email' })]);
      fixture.componentRef.setInput('sbDocument', node);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe('<a href="mailto:test@example.com">Email</a>');
    });

    it('renders asset link', async () => {
      const node = text('Download', [
        linkMark('https://assets.example.com/file.pdf', { linktype: 'asset' }),
      ]);
      fixture.componentRef.setInput('sbDocument', node);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe('<a href="https://assets.example.com/file.pdf">Download</a>');
    });

    it('renders link without href when empty', async () => {
      const node: SbRichTextDoc = {
        type: 'text',
        text: 'No href',
        marks: [
          {
            type: 'link',
            attrs: { href: '', linktype: 'url', uuid: null, anchor: null, target: null },
          },
        ],
      };
      fixture.componentRef.setInput('sbDocument', node);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe('<a>No href</a>');
    });

    it('filters null attributes', async () => {
      const node = text('Link', [linkMark('/')]);
      fixture.componentRef.setInput('sbDocument', node);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).not.toContain('target=');
      expect(html).not.toContain('uuid=');
      expect(html).not.toContain('anchor=');
    });
  });

  // ============================================================================
  // Tests: Link Mark Merging
  // ============================================================================

  describe('link mark merging', () => {
    it('merges adjacent text nodes with same link', async () => {
      const content: SbRichTextDoc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [text('Hello ', [linkMark('/url')]), text('World', [linkMark('/url')])],
          },
        ],
      };
      fixture.componentRef.setInput('sbDocument', content);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe('<p><a href="/url">Hello World</a></p>');
    });

    it('preserves inner marks when merging', async () => {
      const content: SbRichTextDoc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              text('normal ', [linkMark('/url')]),
              text('bold', [{ type: 'bold' }, linkMark('/url')]),
              text(' text', [linkMark('/url')]),
            ],
          },
        ],
      };
      fixture.componentRef.setInput('sbDocument', content);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe('<p><a href="/url">normal <strong>bold</strong> text</a></p>');
    });

    it('handles multiple inner marks', async () => {
      const content: SbRichTextDoc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              text('start ', [linkMark('/url')]),
              text('bold', [{ type: 'bold' }, linkMark('/url')]),
              text(' and ', [linkMark('/url')]),
              text('italic', [{ type: 'italic' }, linkMark('/url')]),
              text(' end', [linkMark('/url')]),
            ],
          },
        ],
      };
      fixture.componentRef.setInput('sbDocument', content);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe(
        '<p><a href="/url">start <strong>bold</strong> and <em>italic</em> end</a></p>',
      );
    });

    it('breaks group on non-text node', async () => {
      const content: SbRichTextDoc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              text('Before ', [linkMark('/x')]),
              { type: 'hard_break' },
              text('After', [linkMark('/x')]),
            ],
          },
        ],
      };
      fixture.componentRef.setInput('sbDocument', content);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe('<p><a href="/x">Before </a><br><a href="/x">After</a></p>');
    });

    it('separates groups when link attrs differ', async () => {
      const content: SbRichTextDoc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              text('A', [linkMark('/a')]),
              text('B', [linkMark('/a', { target: '_blank' })]),
            ],
          },
        ],
      };
      fixture.componentRef.setInput('sbDocument', content);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe('<p><a href="/a">A</a><a href="/a" target="_blank">B</a></p>');
    });
  });

  // ============================================================================
  // Tests: Text Alignment
  // ============================================================================

  describe('text alignment', () => {
    it('renders paragraph with text-align style', async () => {
      const p: SbRichTextDoc = {
        type: 'paragraph',
        attrs: { textAlign: 'right' },
        content: [text('Right')],
      };
      fixture.componentRef.setInput('sbDocument', p);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe('<p style="text-align: right;">Right</p>');
    });

    it.each(['left', 'center', 'right', 'justify'] as const)(
      'supports %s alignment',
      async (align) => {
        const p: SbRichTextDoc = {
          type: 'paragraph',
          attrs: { textAlign: align },
          content: [text('Text')],
        };
        fixture.componentRef.setInput('sbDocument', p);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        const html = fixture.nativeElement.innerHTML.trim();

        expect(html).toContain(`text-align: ${align};`);
      },
    );

    it('renders heading with alignment', async () => {
      const heading: SbRichTextDoc = {
        type: 'heading',
        attrs: { level: 2, textAlign: 'center' },
        content: [text('Centered')],
      };
      fixture.componentRef.setInput('sbDocument', heading);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe('<h2 style="text-align: center;">Centered</h2>');
    });

    it('combines alignment with marks', async () => {
      const p: SbRichTextDoc = {
        type: 'paragraph',
        attrs: { textAlign: 'center' },
        content: [text('Styled', [{ type: 'bold' }])],
      };
      fixture.componentRef.setInput('sbDocument', p);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe('<p style="text-align: center;"><strong>Styled</strong></p>');
    });

    it('renders empty paragraph with alignment', async () => {
      const p: SbRichTextDoc = {
        type: 'paragraph',
        attrs: { textAlign: 'center' },
        content: [],
      };
      fixture.componentRef.setInput('sbDocument', p);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe('<p style="text-align: center;"></p>');
    });
  });

  // ============================================================================
  // Tests: Custom Renderers (via Angular Components)
  // ============================================================================

  describe('custom renderers', () => {
    it('overrides node rendering with custom component', async () => {
      const node: SbRichTextDoc = { type: 'paragraph', content: [text('Hello')] };
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [SbRichTextComponent],
        providers: [
          {
            provide: StoryblokRichtextResolver,
            useValue: createMockResolver({ paragraph: MockCustomParagraphComponent }),
          },
        ],
      }).compileComponents();
      fixture = TestBed.createComponent(SbRichTextComponent);

      fixture.componentRef.setInput('sbDocument', node);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const customNode = fixture.nativeElement.querySelector('.custom-node');

      expect(customNode).toBeTruthy();
      expect(customNode.textContent.trim()).toBe('Hello');
    });

    it('overrides mark rendering with custom component', async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [SbRichTextComponent],
        providers: [
          {
            provide: StoryblokRichtextResolver,
            useValue: createMockResolver({ link: MockCustomMarkComponent }),
          },
        ],
      }).compileComponents();
      fixture = TestBed.createComponent(SbRichTextComponent);

      const node: SbRichTextDoc = {
        type: 'paragraph',
        content: [text('Bold Link', [{ type: 'bold' }, linkMark('https://example.com')])],
      };
      fixture.componentRef.setInput('sbDocument', node);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const customMark = fixture.nativeElement.querySelector('.custom-link');

      expect(customMark).toBeTruthy();
      expect(customMark.textContent.trim()).toContain('Bold Link');
    });
  });

  // ============================================================================
  // Tests: Blok Nodes
  // ============================================================================

  describe('blok nodes', () => {
    it('renders blok via StoryblokComponent when body has items', async () => {
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
      fixture.componentRef.setInput('sbDocument', blokDoc);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      // Angular renders bloks via StoryblokComponent
      expect(html).toContain('sb-component');
    });

    it('renders nothing for empty body', async () => {
      const emptyBlok: SbRichTextDoc = {
        type: 'doc',
        content: [{ type: 'blok', attrs: { id: 'x', body: [] } }],
      };
      fixture.componentRef.setInput('sbDocument', emptyBlok);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe('');
    });

    it('renders nothing for null body', async () => {
      const nullBlok: SbRichTextDoc = {
        type: 'doc',
        content: [{ type: 'blok', attrs: { id: 'x', body: null } }],
      };
      fixture.componentRef.setInput('sbDocument', nullBlok);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toBe('');
    });

    it('renders other content alongside blok', async () => {
      const content: SbRichTextDoc = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [text('Before')] },
          { type: 'blok', attrs: { id: 'x', body: [{ _uid: '1', component: 'test' }] } },
          { type: 'paragraph', content: [text('After')] },
        ],
      };
      fixture.componentRef.setInput('sbDocument', content);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      // Both paragraphs render, with blok component in between
      expect(html).toContain('<p>Before</p>');
      expect(html).toContain('<p>After</p>');
      expect(html).toContain('sb-component');
    });
  });

  // ============================================================================
  // Tests: XSS Prevention
  // ============================================================================

  describe('xSS prevention', () => {
    it('escapes HTML in text content', async () => {
      const node = text('<script>alert("xss")</script>');
      fixture.componentRef.setInput('sbDocument', node);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();
      expect(html).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
    });

    it('escapes HTML in attributes', async () => {
      const node = text('Link', [linkMark('javascript:alert("xss")')]);
      fixture.componentRef.setInput('sbDocument', node);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toContain('href="javascript:alert(&quot;xss&quot;)"');
    });
  });
});
