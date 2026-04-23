import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
  ElementRef,
  Renderer2,
  AfterViewInit,
  OnDestroy,
  Type,
  ViewEncapsulation,
  Injector,
  createComponent,
  EnvironmentInjector,
  ApplicationRef,
  ComponentRef,
  reflectComponentType,
  effect,
  untracked,
  signal,
} from '@angular/core';
import { StoryblokRichtextResolver } from './richtext.feature';
import {
  getStaticChildren,
  isSelfClosing,
  processAttrs,
  resolveTag,
} from '@storyblok/richtext/static';
import type { RenderSpec, StoryblokRichTextJson } from '@storyblok/richtext/static';

/**
 * Renders Storyblok rich text content with support for custom component overrides.
 *
 * This component parses the Storyblok rich text document into an AST and renders
 * it directly to the DOM using `Renderer2` for clean, wrapper-free output.
 * Custom components are supported via `withStoryblokRichtextComponents()`.
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
 * import { Component, input } from '@angular/core';
 * import { SbRichTextNodeComponent, type AngularRenderNode } from '@storyblok/angular';
 *
 * @Component({
 *   selector: 'app-custom-link',
 *   imports: [SbRichTextNodeComponent],
 *   template: `
 *     <a [href]="href()" [target]="target()">
 *       <sb-rich-text-node [nodes]="children()" />
 *     </a>
 *   `,
 * })
 * export class CustomLinkComponent {
 *   readonly href = input<string>();
 *   readonly target = input<string>();
 *   readonly children = input<AngularRenderNode[]>([]);
 * }
 * ```
 *
 * ## DOM Output
 *
 * The component renders clean HTML directly inside the host element:
 * ```html
 * <sb-rich-text style="display: contents">
 *   <h1><strong>Hello World</strong></h1>
 *   <p>Some text with <a href="...">a link</a></p>
 * </sb-rich-text>
 * ```
 */
@Component({
  selector: 'sb-rich-text',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: ``,
  host: { style: 'display: contents' },
})
export class SbRichTextComponent implements AfterViewInit, OnDestroy {
  /** The Storyblok rich text document to render. */
  doc = input.required<StoryblokRichTextJson | null | undefined>();

  private readonly renderer = inject(Renderer2);
  private readonly hostElement: HTMLElement = inject(ElementRef).nativeElement;
  private readonly hasRendered = signal(false);

  constructor() {
    effect(() => {
      const richTextDoc = this.doc();
      // Only re-render on changes after the initial render is complete.
      if (this.hasRendered()) {
        this.render(richTextDoc);
      }
    });
  }

  ngAfterViewInit(): void {
    // For SSR hydration, if the server has already rendered content,
    // we avoid clearing it on the client. The effect will handle future updates.
    if (this.hostElement.hasChildNodes()) {
      this.hasRendered.set(true);
      return;
    }
    // Perform the initial render on the client if not pre-rendered.
    this.render(this.doc());
    this.hasRendered.set(true);
  }

  ngOnDestroy(): void {
    this.clearContent();
  }

  /**
   * Renders the entire rich text document.
   */
  private render(doc: StoryblokRichTextJson | null | undefined): void {
    this.clearContent();

    if (!doc) {
      return;
    }

    const nodes = doc.type === 'doc' && doc.content ? doc.content : [doc];

    if (!nodes || nodes.length === 0) {
      return;
    }

    for (const node of nodes) {
      this.renderNode(node, this.hostElement);
    }
  }

  /**
   * Renders a single rich text node.
   */
  private renderNode(node: StoryblokRichTextJson, parent: HTMLElement): void {
    if (node.type === 'text') {
      this.renderTextNode(node, parent);
      return;
    }

    if (node.type === 'blok') {
      console.warn('Rendering of "blok" nodes is not supported in SbRichTextComponent.');
      return;
    }

    const tag = resolveTag(node);
    if (!tag) {
      return; // Unknown or un-renderable node type
    }

    const attrs = processAttrs(node.type, node.attrs);
    const element = this.renderer.createElement(tag);
    const staticChildren = getStaticChildren(node);

    // If a node has a static scaffold (like <code> inside <pre>), the attributes
    // belong to an inner element, not the main tag. We'll pass them to `createStaticScaffold`.
    if (!staticChildren) {
      this.applyAttributes(element, attrs);
    }

    if (isSelfClosing(tag)) {
      this.renderer.appendChild(parent, element);
      return;
    }

    let contentHost = element;

    if (staticChildren) {
      contentHost = this.createStaticScaffold(staticChildren, element, attrs);
    }

    if (node.content) {
      for (const childNode of node.content) {
        this.renderNode(childNode, contentHost);
      }
    }

    this.renderer.appendChild(parent, element);
  }

  /**
   * Renders a text node and applies its marks (e.g., bold, italic).
   */
  private renderTextNode(
    node: StoryblokRichTextJson & { type: 'text' },
    parent: HTMLElement,
  ): void {
    const textNode = this.renderer.createText(node.text || '');

    if (!node.marks || node.marks.length === 0) {
      this.renderer.appendChild(parent, textNode);
      return;
    }

    // Create a chain of mark elements, with the text node at the very end.
    // The first mark in the array is the outermost.
    const lastMarkElement = node.marks.reduce((currentParent, mark) => {
      const tag = resolveTag(mark);
      if (!tag) return currentParent;

      const markElement = this.renderer.createElement(tag);
      const attrs = processAttrs(mark.type, mark.attrs);
      this.applyAttributes(markElement, attrs);

      this.renderer.appendChild(currentParent, markElement);
      return markElement;
    }, parent);

    this.renderer.appendChild(lastMarkElement, textNode);
  }

  /**
   * Creates a pre-defined DOM structure (e.g., for tables or code blocks)
   * and returns the element where the node's content should be rendered.
   */
  private createStaticScaffold(
    specs: readonly RenderSpec[],
    parent: HTMLElement,
    nodeAttrs: Record<string, unknown> = {},
  ): HTMLElement {
    let contentHost = parent;
    for (const spec of specs) {
      const el = this.renderer.createElement(spec.tag);
      // The node's attributes are merged with the static child's own attributes.
      const mergedAttrs = { ...spec.attrs, ...nodeAttrs };

      this.applyAttributes(el, mergedAttrs);
      this.renderer.appendChild(contentHost, el);

      if (spec.children) {
        // For deeper levels, we don't pass the node's attributes again.
        contentHost = this.createStaticScaffold(spec.children, el);
      } else {
        contentHost = el;
      }
    }
    return contentHost;
  }

  /**
   * Applies attributes to a DOM element using Renderer2.
   */
  private applyAttributes(element: HTMLElement, attrs: Record<string, any> = {}): void {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined) continue;

      if (key === 'style' && typeof value === 'object') {
        for (const [styleKey, styleValue] of Object.entries(value)) {
          this.renderer.setStyle(element, styleKey, String(styleValue));
        }
      } else {
        this.renderer.setAttribute(element, key, String(value));
      }
    }
  }

  /**
   * Removes all child nodes from the host element.
   */
  private clearContent(): void {
    let child: ChildNode | null;
    while ((child = this.hostElement.firstChild)) {
      this.renderer.removeChild(this.hostElement, child);
    }
  }
}
