import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
  SecurityContext,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { type StoryblokRichTextNode, type StoryblokRichTextOptions } from '@storyblok/richtext';
import { SbBlokDirective } from './sb-blok.directive';
import { parseStoryblokRichText, RichTextSegment } from '../utils/parse-richtext';

/**
 * Component that renders Storyblok rich text content with support for embedded bloks.
 *
 * This component allows you to render embedded Storyblok components (bloks) within rich text using your registered
 * components from `withStoryblokComponents()`.
 *
 * @example Basic usage
 * ```html
 * <sb-rich-text [doc]="blok().richTextField" />
 * ```
 *
 * @example With custom class
 * ```html
 * <sb-rich-text [doc]="blok().content" class="prose prose-lg" />
 * ```
 *
 * @example With image optimization
 * ```html
 * <sb-rich-text [doc]="blok().content" [options]="richTextOptions" />
 * ```
 *
 * ```typescript
 * readonly richTextOptions: StoryblokRichTextOptions = {
 *   optimizeImages: { width: 800, filters: { format: 'webp' } }
 * };
 * ```
 */
@Component({
  selector: 'sb-rich-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SbBlokDirective],
  template: `
    @for (segment of segments(); track trackSegment($index, segment)) {
      @if (segment.type === 'html') {
        <span [innerHTML]="segment.content"></span>
      } @else {
        <ng-container [sbBlok]="segment.blok" />
      }
    }
  `,
  host: {
    style: 'display: block',
  },
})
export class SbRichTextComponent {
  private readonly sanitizer = inject(DomSanitizer);

  /** The rich text document from Storyblok */
  readonly doc = input<StoryblokRichTextNode<string> | null>();

  /** Optional configuration for the rich text resolver */
  readonly options = input<StoryblokRichTextOptions<string>>();

  /** Parsed segments of the rich text (HTML or bloks) */
  readonly segments = computed<RichTextSegment[]>(() => {
    const doc = this.doc();
    if (!doc) return [];
    return parseStoryblokRichText(doc, this.options()).map((segment) =>
      segment.type === 'html' ? { ...segment, content: this.sanitize(segment.content) } : segment,
    );
  });

  /**
   * Track function for @for loop - uses blok _uid for bloks, index for HTML
   */
  trackSegment(index: number, segment: RichTextSegment): string {
    return segment.type === 'blok' ? (segment.blok._uid ?? `blok-${index}`) : `html-${index}`;
  }

  /**
   * Sanitize HTML content for safe rendering
   */
  private sanitize(html: string): string {
    return this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';
  }
}
