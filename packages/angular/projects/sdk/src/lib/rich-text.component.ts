import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
} from '@angular/core';
import type { StoryblokRichTextNode, StoryblokSegmentType } from '@storyblok/richtext';
import { getRichTextSegments, renderSegments } from '@storyblok/richtext';
import {
  STORYBLOK_RICHTEXT_COMPONENTS,
  createAngularAdapter,
  type AngularRenderNode,
} from './richtext.feature';
import { RichTextNodeComponent } from './rich-text-node.component';

/**
 * Renders Storyblok rich text content with support for custom component overrides.
 *
 * This component parses the Storyblok rich text document into an AST and renders
 * it using Angular components. You can override how specific node types are rendered
 * by providing custom components via `withStoryblokRichtextComponents()`.
 *
 * @example Basic usage
 * ```html
 * <sb-richtext [doc]="story.content.body" />
 * ```
 *
 * @example With custom component overrides
 * ```typescript
 * // In your providers:
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
 *   template: `
 *     <a [href]="href()" [target]="target()">
 *       @for (child of children(); track $index) {
 *         <sb-richtext-node [node]="child" />
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
  selector: 'sb-richtext',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RichTextNodeComponent],
  template: `
    @for (node of nodes(); track $index) {
      <sb-richtext-node [node]="node" />
    }
  `,
  host: { style: 'display: contents' },
})
export class RichTextComponent {
  private readonly components = inject(STORYBLOK_RICHTEXT_COMPONENTS);

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
    const keys = Object.keys(this.components) as StoryblokSegmentType[];

    // 4. Render segments to Angular AST
    return renderSegments(segments, adapter, keys);
  });
}
