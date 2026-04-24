import { Component, input, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SbRichTextComponent } from './rich-text.component';
import { StoryblokRichtextResolver } from './richtext.feature';

/**
 * Mock custom node component
 */
@Component({
  selector: 'app-custom-paragraph',
  standalone: true,
  imports: [SbRichTextComponent],
  template: `<div class="custom-node">
    @for (doc of data().content ?? []; track doc) {
      <sb-rich-text [sbDocument]="doc" />
    }
  </div>`,
})
class MockCustomParagraphComponent {
  data = input<any>();
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
  data = input<any>();
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

  it('should render normal richtext HTML nodes', async () => {
    fixture.componentRef.setInput('sbDocument', {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Hello World',
            },
          ],
        },
      ],
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const p = fixture.nativeElement.querySelector('p');

    expect(p).toBeTruthy();
    expect(p.textContent.trim()).toBe('Hello World');
  });

  it('should render native marks like strong', async () => {
    fixture.componentRef.setInput('sbDocument', {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Bold Text',
              marks: [
                {
                  type: 'bold',
                },
              ],
            },
          ],
        },
      ],
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const strong = fixture.nativeElement.querySelector('strong');

    expect(strong).toBeTruthy();
    expect(strong.textContent.trim()).toBe('Bold Text');
  });

  it('should render custom node component when resolver returns component', async () => {
    // Reset TestBed with custom component registered in resolver
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

    fixture.componentRef.setInput('sbDocument', {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Custom Paragraph',
            },
          ],
        },
      ],
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const customNode = fixture.nativeElement.querySelector('.custom-node');

    expect(customNode).toBeTruthy();
    expect(customNode.textContent.trim()).toBe('Custom Paragraph');
  });

  it('should render custom mark component when resolver returns component', async () => {
    // Reset TestBed with custom mark component registered in resolver
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

    fixture.componentRef.setInput('sbDocument', {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: {
            textAlign: null,
          },
          content: [
            {
              text: 'Line ',
              type: 'text',
            },
            {
              text: 'one',
              type: 'text',
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: '/',
                    uuid: '8ce97fe6-b8e5-4c7e-a2f2-f84d96daa6eb',
                    anchor: null,
                    custom: {},
                    target: '_self',
                    linktype: 'story',
                  },
                },
              ],
            },
            {
              type: 'hard_break',
            },
            {
              text: 'Line two (after hard break)',
              type: 'text',
            },
            {
              type: 'hard_break',
            },
            {
              text: 'Line three',
              type: 'text',
            },
          ],
        },
      ],
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const customMark = fixture.nativeElement.querySelector('.custom-link');
    expect(customMark).toBeTruthy();
    expect(customMark.textContent.trim()).toContain('one');
  });

  it('should clear old content when doc changes', async () => {
    fixture.componentRef.setInput('sbDocument', {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'First',
            },
          ],
        },
      ],
    });

    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentRef.setInput('sbDocument', {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Second',
            },
          ],
        },
      ],
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const paragraphs = fixture.nativeElement.querySelectorAll('p');

    expect(paragraphs.length).toBe(1);
    expect(paragraphs[0].textContent.trim()).toBe('Second');
  });

  it('should not fail when doc is null', async () => {
    fixture.componentRef.setInput('sbDocument', null);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });
});
