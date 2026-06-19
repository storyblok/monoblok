import { Component, input, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SbRichTextComponent } from './rich-text.component';
import { StoryblokRichtextResolver } from './richtext.feature';
import type { SbRichTextDoc, SbRichTextNode } from '@storyblok/richtext';
import type { SbAngularRichTextProps } from '../types';
import {
  text,
  linkMark,
  nodeFixtures,
  markFixtures,
  tableFixtures,
  linkFixtures,
} from '@storyblok/richtext/test-utils';

/**
 * Mock custom node component
 */
@Component({
  selector: 'app-custom-paragraph',
  standalone: true,
  imports: [SbRichTextComponent],
  template: `<div class="custom-node">
    <sb-rich-text [sbDocument]="data().content" />
  </div>`,
})
class MockCustomParagraphComponent {
  readonly data = input.required<SbAngularRichTextProps<'paragraph'>>();
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
  readonly data = input.required<SbAngularRichTextProps<'link'>>();
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
      const textContent = fixture.nativeElement.textContent.trim();
      expect(textContent).toBe('');
    });

    it('returns empty string for undefined input', async () => {
      fixture.componentRef.setInput('sbDocument', undefined);
      fixture.detectChanges();
      const textContent = fixture.nativeElement.textContent.trim();
      expect(textContent).toBe('');
    });

    it('returns empty string for empty array', async () => {
      fixture.componentRef.setInput('sbDocument', []);
      fixture.detectChanges();
      const textContent = fixture.nativeElement.textContent.trim();
      expect(textContent).toBe('');
    });
  });
  describe('nodes', () => {
    nodeFixtures.forEach(({ title, input, expected }) => {
      it(title, () => {
        fixture.componentRef.setInput('sbDocument', input);
        fixture.detectChanges();
        const html = fixture.nativeElement.innerHTML.trim();
        expect(html).toBe(expected);
      });
    });
  });
  describe('marks', () => {
    markFixtures.forEach(({ title, input, expected }) => {
      it(title, () => {
        fixture.componentRef.setInput('sbDocument', input);
        fixture.detectChanges();
        const html = fixture.nativeElement.innerHTML.trim();
        expect(html).toBe(expected);
      });
    });
  });
  describe('links', () => {
    linkFixtures.forEach(({ title, input, expected }) => {
      it(title, () => {
        fixture.componentRef.setInput('sbDocument', input);
        fixture.detectChanges();
        const html = fixture.nativeElement.innerHTML.trim();
        expect(html).toBe(expected);
      });
    });
  });
  describe('tables', () => {
    tableFixtures.forEach(({ title, input, expected }) => {
      it(title, () => {
        fixture.componentRef.setInput('sbDocument', input);
        fixture.detectChanges();
        const html = fixture.nativeElement.innerHTML.trim();
        expect(html).toBe(expected);
      });
    });
  });
  describe('custom renderers', () => {
    it('overrides node rendering with custom component', async () => {
      const node: SbRichTextNode = { type: 'paragraph', content: [text('Hello')] };
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

      const node: SbRichTextNode = {
        type: 'paragraph',
        content: [text('Bold Link', [{ type: 'bold' }, linkMark('https://example.com')])],
      };
      fixture.componentRef.setInput('sbDocument', node);
      fixture.detectChanges();

      const customMark = fixture.nativeElement.querySelector('.custom-link');

      expect(customMark).toBeTruthy();
      expect(customMark.textContent.trim()).toContain('Bold Link');
    });

    it('allows custom code_block component to control attribute placement', async () => {
      @Component({
        selector: 'app-custom-code-block',
        standalone: true,
        imports: [SbRichTextComponent],
        template: `
          <pre class="language-{{ lang() }}">
          <code [attr.data-lang]="lang()">
            <sb-rich-text [sbDocument]="data().content" />
          </code>
        </pre>
        `,
      })
      class MockCustomCodeBlockComponent {
        readonly data = input.required<SbAngularRichTextProps<'code_block'>>();
        lang = () => (this.data()?.attrs?.['class'] as string) || '';
      }

      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [SbRichTextComponent],
        providers: [
          {
            provide: StoryblokRichtextResolver,
            useValue: createMockResolver({ code_block: MockCustomCodeBlockComponent }),
          },
        ],
      }).compileComponents();
      fixture = TestBed.createComponent(SbRichTextComponent);

      const codeBlock: SbRichTextNode = {
        type: 'code_block',
        attrs: { class: 'js' },
        content: [text('const x: number = 1;')],
      };
      fixture.componentRef.setInput('sbDocument', codeBlock);
      fixture.detectChanges();

      const pre = fixture.nativeElement.querySelector('pre');
      const code = fixture.nativeElement.querySelector('code');
      expect(pre?.className).toBe('language-js');
      expect(code?.getAttribute('data-lang')).toBe('js');
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

      const html = fixture.nativeElement.innerHTML.trim();
      expect(html).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
    });

    it('escapes HTML in attributes', async () => {
      const node = text('Link', [linkMark('javascript:alert("xss")')]);
      fixture.componentRef.setInput('sbDocument', node);
      fixture.detectChanges();

      const html = fixture.nativeElement.innerHTML.trim();

      expect(html).toContain('href="javascript:alert(&quot;xss&quot;)"');
    });
  });

  // ============================================================================
  // Tests: Image Optimization
  // ============================================================================

  describe('image optimization', () => {
    // Use type assertion to allow partial image attrs for testing
    const imageNode = {
      type: 'image',
      attrs: {
        src: 'https://a.storyblok.com/f/12345/800x600/abc123/image.jpg',
        alt: 'Test image',
      },
    } as SbRichTextNode;

    it('renders image without optimization when sbOptimizeImage is false', async () => {
      fixture.componentRef.setInput('sbDocument', imageNode);
      fixture.componentRef.setInput('sbOptimizeImage', false);
      fixture.detectChanges();

      const img = fixture.nativeElement.querySelector('img');
      expect(img).toBeTruthy();
      expect(img.getAttribute('src')).toBe(
        'https://a.storyblok.com/f/12345/800x600/abc123/image.jpg',
      );
    });

    it('renders optimized image when sbOptimizeImage is true', async () => {
      fixture.componentRef.setInput('sbDocument', imageNode);
      fixture.componentRef.setInput('sbOptimizeImage', true);
      fixture.detectChanges();

      const img = fixture.nativeElement.querySelector('img');
      expect(img).toBeTruthy();
      // When true, buildStoryblokImage adds /m/ to the URL
      expect(img.getAttribute('src')).toBe(
        'https://a.storyblok.com/f/12345/800x600/abc123/image.jpg/m/',
      );
    });

    it('applies custom optimization options', async () => {
      fixture.componentRef.setInput('sbDocument', imageNode);
      fixture.componentRef.setInput('sbOptimizeImage', {
        width: 400,
        height: 300,
        loading: 'lazy',
      });
      fixture.detectChanges();

      const img = fixture.nativeElement.querySelector('img');
      expect(img).toBeTruthy();
      expect(img.getAttribute('src')).toBe(
        'https://a.storyblok.com/f/12345/800x600/abc123/image.jpg/m/400x300/',
      );
      expect(img.getAttribute('width')).toBe('400');
      expect(img.getAttribute('height')).toBe('300');
      expect(img.getAttribute('loading')).toBe('lazy');
    });

    it('handles image without src gracefully', async () => {
      const noSrcImage = {
        type: 'image',
        attrs: { alt: 'No source' },
      } as SbRichTextNode;
      fixture.componentRef.setInput('sbDocument', noSrcImage);
      fixture.componentRef.setInput('sbOptimizeImage', true);
      fixture.detectChanges();

      const img = fixture.nativeElement.querySelector('img');
      expect(img).toBeFalsy();
    });

    it('renders nested images with optimization', async () => {
      const doc: SbRichTextDoc = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [text('Before image')] },
          imageNode,
          { type: 'paragraph', content: [text('After image')] },
        ],
      };
      fixture.componentRef.setInput('sbDocument', doc);
      fixture.componentRef.setInput('sbOptimizeImage', { width: 200 });
      fixture.detectChanges();

      const img = fixture.nativeElement.querySelector('img');
      expect(img).toBeTruthy();
      expect(img.getAttribute('src')).toContain('/m/200x0/');
    });
  });
});
