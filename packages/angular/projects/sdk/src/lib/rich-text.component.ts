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
} from '@angular/core';
import type { StoryblokRichTextNode } from '@storyblok/richtext';
import { getRichTextSegments, renderSegments, isVoidElement } from '@storyblok/richtext';
import {
  StoryblokRichtextResolver,
  createAngularAdapter,
  type AngularRenderNode,
  isTextNode,
  isTagNode,
  isComponentNode,
} from './richtext.feature';

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
  private readonly resolver = inject(StoryblokRichtextResolver);
  private readonly renderer = inject(Renderer2);
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);
  private readonly envInjector = inject(EnvironmentInjector);
  private readonly appRef = inject(ApplicationRef);

  /** Track dynamically created components for cleanup */
  private readonly componentRefs: ComponentRef<unknown>[] = [];

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

  ngAfterViewInit(): void {
    const nodes = this.nodes();
    const hostElement = this.el.nativeElement;

    if (!hostElement || !nodes.length) return;

    // Render all nodes directly inside the host element
    for (const node of nodes) {
      this.renderNode(node, hostElement);
    }
  }

  ngOnDestroy(): void {
    // Clean up dynamically created components
    for (const ref of this.componentRefs) {
      this.appRef.detachView(ref.hostView);
      ref.destroy();
    }
    this.componentRefs.length = 0;
  }

  /**
   * Renders a single AST node to the DOM.
   */
  private renderNode(node: AngularRenderNode, parent: Element): void {
    if (isTextNode(node)) {
      const textNode = this.renderer.createText(node);
      this.renderer.appendChild(parent, textNode);
      return;
    }

    if (isTagNode(node)) {
      const element = this.renderer.createElement(node.tag);

      if (node.attrs) {
        this.applyAttributes(element, node.attrs);
      }

      this.renderer.appendChild(parent, element);

      // Render children inside the element (skip for void elements like img, br, hr)
      if (!isVoidElement(node.tag) && node.children?.length) {
        for (const child of node.children) {
          this.renderNode(child, element);
        }
      }
      return;
    }

    if (isComponentNode(node)) {
      this.renderComponentNode(node, parent);
    }
  }

  /**
   * Renders a custom component node, handling lazy loading.
   */
  private renderComponentNode(
    node: { component: string; props: Record<string, unknown>; children?: AngularRenderNode[] },
    parent: Element,
  ): void {
    // Try sync resolution first (eager or cached)
    const componentType = this.resolver.getSync(node.component as any);

    if (componentType) {
      this.instantiateComponent(componentType, node, parent);
      return;
    }

    // Check if registered at all
    if (!this.resolver.has(node.component as any)) {
      // No component registered - render children as fallback
      if (node.children?.length) {
        for (const child of node.children) {
          this.renderNode(child, parent);
        }
      }
      return;
    }

    // Lazy load the component
    this.resolver.resolve(node.component as any).then((resolved) => {
      if (resolved) {
        this.instantiateComponent(resolved, node, parent);
      } else if (node.children?.length) {
        // Fallback: render children if component couldn't be resolved
        for (const child of node.children) {
          this.renderNode(child, parent);
        }
      }
    });
  }

  /**
   * Creates and appends a component instance.
   */
  private instantiateComponent(
    componentType: Type<unknown>,
    node: { props: Record<string, unknown>; children?: AngularRenderNode[] },
    parent: Element,
  ): void {
    const componentRef = createComponent(componentType, {
      environmentInjector: this.envInjector,
      elementInjector: this.injector,
    });

    this.componentRefs.push(componentRef);

    const children = node.children ?? [];

    // Get the component's declared inputs
    const mirror = reflectComponentType(componentType);
    const declaredInputs = new Set(mirror?.inputs.map((i) => i.propName) ?? []);

    // Set individual inputs only if they are declared on the component
    for (const [key, value] of Object.entries(node.props)) {
      if (declaredInputs.has(key)) {
        componentRef.setInput(key, value);
      }
    }

    // Set children if declared
    if (declaredInputs.has('children')) {
      componentRef.setInput('children', children);
    }

    // Pass all props as a single object if the component declares a 'props' input
    if (declaredInputs.has('props')) {
      componentRef.setInput('props', { ...node.props, children });
    }

    // Attach to Angular's change detection
    this.appRef.attachView(componentRef.hostView);

    // Append to DOM
    const element = componentRef.location.nativeElement;
    this.renderer.appendChild(parent, element);

    // Trigger initial change detection
    componentRef.changeDetectorRef.detectChanges();
  }

  /**
   * Applies attributes to an element, handling style and class specially.
   */
  private applyAttributes(element: Element, attrs: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === undefined || value === null) continue;

      if (key === 'style') {
        if (typeof value === 'string') {
          this.renderer.setAttribute(element, 'style', value);
        } else if (typeof value === 'object') {
          for (const [prop, val] of Object.entries(value as Record<string, string>)) {
            this.renderer.setStyle(element, prop, val);
          }
        }
      } else if (key === 'class') {
        this.renderer.setAttribute(element, 'class', String(value));
      } else {
        this.renderer.setAttribute(element, key, String(value));
      }
    }
  }
}
