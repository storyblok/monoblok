import {
  Component,
  ChangeDetectionStrategy,
  input,
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
import { isVoidElement } from '@storyblok/richtext';
import {
  StoryblokRichtextResolver,
  type AngularRenderNode,
  isTextNode,
  isTagNode,
  isComponentNode,
} from './richtext.feature';

/**
 * Renders rich text AST nodes for use inside custom components.
 *
 * This component is designed to be used by custom rich text components
 * that need to render their children. It renders nodes directly to the
 * parent element, removing its own host element for clean DOM output.
 *
 * @example Using in a custom link component with individual inputs
 * ```typescript
 * import { Component, input } from '@angular/core';
 * import { SbRichTextNodeComponent, type AngularRenderNode } from '@storyblok/angular';
 *
 * @Component({
 *   selector: 'app-custom-link',
 *   imports: [SbRichTextNodeComponent],
 *   template: `
 *     <a [href]="href()" [target]="target()" class="custom-link">
 *       <sb-rich-text-node [nodes]="children()" />
 *     </a>
 *   `,
 * })
 * export class CustomLinkComponent {
 *   readonly href = input<string>();
 *   readonly target = input<string>('_self');
 *   readonly children = input<AngularRenderNode[]>([]);
 * }
 * ```
 *
 * @example Using a single props input for flexibility
 * ```typescript
 * import { Component, input, computed } from '@angular/core';
 * import { SbRichTextNodeComponent, type AngularRenderNode } from '@storyblok/angular';
 *
 * interface LinkProps {
 *   href?: string;
 *   target?: string;
 *   children?: AngularRenderNode[];
 * }
 *
 * @Component({
 *   selector: 'app-custom-link',
 *   imports: [SbRichTextNodeComponent],
 *   template: `
 *     <a [href]="href()" [target]="target()" class="custom-link">
 *       <sb-rich-text-node [nodes]="children()" />
 *     </a>
 *   `,
 * })
 * export class CustomLinkComponent {
 *   readonly props = input<LinkProps>({});
 *   readonly href = computed(() => this.props().href ?? '');
 *   readonly target = computed(() => this.props().target ?? '_self');
 *   readonly children = computed(() => this.props().children ?? []);
 * }
 * ```
 *
 * @example Using in a custom image component
 * ```typescript
 * @Component({
 *   selector: 'app-optimized-image',
 *   template: `
 *     <figure>
 *       <img [src]="src()" [alt]="alt()" loading="lazy" />
 *       @if (title()) {
 *         <figcaption>{{ title() }}</figcaption>
 *       }
 *     </figure>
 *   `,
 * })
 * export class OptimizedImageComponent {
 *   readonly src = input<string>();
 *   readonly alt = input<string>('');
 *   readonly title = input<string>();
 *   readonly children = input<AngularRenderNode[]>([]); // May be empty for images
 * }
 * ```
 *
 * ## DOM Output
 *
 * The component removes its host element after rendering, producing clean output:
 * ```html
 * <!-- Before (with wrapper) -->
 * <a href="...">
 *   <sb-rich-text-node>Link text</sb-rich-text-node>
 * </a>
 *
 * <!-- After (clean) -->
 * <a href="...">Link text</a>
 * ```
 */
@Component({
  selector: 'sb-rich-text-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: ``,
  host: { style: 'display: contents' },
})
export class SbRichTextNodeComponent implements AfterViewInit, OnDestroy {
  private readonly resolver = inject(StoryblokRichtextResolver);
  private readonly renderer = inject(Renderer2);
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);
  private readonly envInjector = inject(EnvironmentInjector);
  private readonly appRef = inject(ApplicationRef);

  /** Track dynamically created components for cleanup */
  private readonly componentRefs: ComponentRef<unknown>[] = [];

  /** The AST nodes to render */
  readonly nodes = input.required<AngularRenderNode[]>();

  ngAfterViewInit(): void {
    const nodes = this.nodes();
    const hostElement = this.el.nativeElement;

    if (!hostElement || !nodes.length) return;

    const parent = hostElement.parentElement;
    if (!parent) return;

    // Render all nodes directly to parent, inserting before the host element
    for (const node of nodes) {
      this.renderNode(node, parent, hostElement);
    }

    // Remove the host element wrapper from DOM
    parent.removeChild(hostElement);
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
  private renderNode(node: AngularRenderNode, parent: Element, before?: Element | null): void {
    if (isTextNode(node)) {
      const textNode = this.renderer.createText(node);
      if (before) {
        parent.insertBefore(textNode, before);
      } else {
        this.renderer.appendChild(parent, textNode);
      }
      return;
    }

    if (isTagNode(node)) {
      const element = this.renderer.createElement(node.tag);

      if (node.attrs) {
        this.applyAttributes(element, node.attrs);
      }

      if (before) {
        parent.insertBefore(element, before);
      } else {
        this.renderer.appendChild(parent, element);
      }

      // Render children inside the element (skip for void elements)
      if (!isVoidElement(node.tag) && node.children?.length) {
        for (const child of node.children) {
          this.renderNode(child, element, null);
        }
      }
      return;
    }

    if (isComponentNode(node)) {
      this.renderComponentNode(node, parent, before);
    }
  }

  /**
   * Renders a custom component node.
   */
  private renderComponentNode(
    node: { component: string; props: Record<string, unknown>; children?: AngularRenderNode[] },
    parent: Element,
    before?: Element | null,
  ): void {
    const componentType = this.resolver.getSync(node.component as any);

    if (componentType) {
      this.instantiateComponent(componentType, node, parent, before);
      return;
    }

    if (!this.resolver.has(node.component as any)) {
      // No component registered - render children as fallback
      if (node.children?.length) {
        for (const child of node.children) {
          this.renderNode(child, parent, before);
        }
      }
      return;
    }

    // Lazy load
    this.resolver.resolve(node.component as any).then((resolved) => {
      if (resolved) {
        this.instantiateComponent(resolved, node, parent, before);
      } else if (node.children?.length) {
        for (const child of node.children) {
          this.renderNode(child, parent, before);
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
    before?: Element | null,
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

    this.appRef.attachView(componentRef.hostView);

    const element = componentRef.location.nativeElement;
    if (before) {
      parent.insertBefore(element, before);
    } else {
      this.renderer.appendChild(parent, element);
    }

    componentRef.changeDetectorRef.detectChanges();
  }

  /**
   * Applies attributes to an element.
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
