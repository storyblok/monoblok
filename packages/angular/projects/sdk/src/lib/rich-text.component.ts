import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
} from '@angular/core';
import type { StoryblokRichTextNode } from '@storyblok/richtext';
import { getRichTextSegments, renderSegments } from '@storyblok/richtext';
import {
  StoryblokRichtextResolver,
  createAngularAdapter,
  type AngularRenderNode,
} from './richtext.feature';
import { SbRichTextNodeComponent } from './rich-text-node.component';

/**
 * Renders Storyblok rich text content with support for custom component overrides.
 *
 * This component parses the Storyblok rich text document into an AST and renders
 * it using Angular components. You can override how specific node types are rendered
 * by providing custom components via `withStoryblokRichtextComponents()`.
 *
 * @example Basic usage
 * ```html
 * <sb-rich-text [doc]="story.content.body" />
 * ```
 *
 * @example With custom component overrides (lazy loading - recommended)
 * ```typescript
 * // In your providers:
 * provideStoryblok(
 *   { accessToken: 'token' },
 *   withStoryblokRichtextComponents({
 *     link: () => import('./custom-link').then(m => m.CustomLinkComponent),
 *     image: () => import('./optimized-image').then(m => m.OptimizedImageComponent),
 *   })
 * )
 * ```
 *
 * @example With custom component overrides (eager loading)
 * ```typescript
 * provideStoryblok(
 *   { accessToken: 'token' },
 *   withStoryblokRichtextComponents({
 *     link: CustomLinkComponent,
 *     image: OptimizedImageComponent,
 *   })
 * )
 * ```
 *
 * @example Custom component receiving children
 * ```typescript
 * @Component({
 *   selector: 'app-custom-link',
 *   imports: [SbRichTextNodeComponent],
 *   template: `
 *     <a [href]="href()" [target]="target()">
 *       @for (child of children(); track $index) {
 *         <sb-rich-text-node [node]="child" />
 *       }
 *     </a>
 *   `,
 * })
 * export class CustomLinkComponent {
 *   readonly href = input<string>();
 *   readonly target = input<string>();
 *   readonly children = input<AngularRenderNode[]>([]);
 * }
 * ```
 */
@Component({
  selector: 'sb-rich-text',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SbRichTextNodeComponent],
  template: `
    @for (node of nodes(); track $index) {
      <sb-rich-text-node [node]="node" />
    }
  `,
  host: { style: 'display: contents' },
})
export class SbRichTextComponent {
  private readonly resolver = inject(StoryblokRichtextResolver);

  /** The Storyblok rich text document to render */
  readonly doc = input.required<StoryblokRichTextNode>();

  /** Computed AST nodes ready for rendering */
  readonly nodes = computed<AngularRenderNode[]>(() => {
    const doc = this.doc();
    if (!doc) return [];

    // 1. Parse rich text into segments
    const segments = getRichTextSegments(doc);

    // 2. Create Angular adapter
    const adapter = createAngularAdapter();

    // 3. Get keys of custom components (these become "component" nodes)
    const keys = this.resolver.getRegisteredTypes();

    // 4. Render segments to Angular AST
    return renderSegments(segments, adapter, keys);
  });
}
