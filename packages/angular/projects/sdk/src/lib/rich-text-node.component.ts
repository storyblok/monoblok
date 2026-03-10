import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
  ElementRef,
  Renderer2,
  OnInit,
  OnDestroy,
  Type,
  ViewEncapsulation,
  Injector,
  createComponent,
  EnvironmentInjector,
  ApplicationRef,
  ComponentRef,
  signal,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { isVoidElement } from '@storyblok/richtext';
import {
  StoryblokRichtextResolver,
  type AngularRenderNode,
  isTextNode,
  isTagNode,
  isComponentNode,
} from './richtext.feature';

/**
 * Recursively renders a single rich text AST node.
 *
 * This component handles three types of nodes:
 * - **Text nodes**: Rendered as plain text
 * - **Tag nodes**: Rendered as HTML elements with attributes
 * - **Component nodes**: Rendered using custom Angular components (supports lazy loading)
 *
 * The component uses Angular's `Renderer2` for SSR-safe DOM manipulation.
 *
 * @internal This component is used internally by `SbRichTextComponent`.
 * Users typically don't need to use this directly, but it's exported
 * for custom component implementations that need to render children.
 *
 * @example Rendering children in a custom component
 * ```typescript
 * @Component({
 *   selector: 'app-custom-link',
 *   imports: [SbRichTextNodeComponent],
 *   template: `
 *     <a [href]="href()">
 *       @for (child of children(); track $index) {
 *         <sb-rich-text-node [node]="child" />
 *       }
 *     </a>
 *   `,
 * })
 * export class CustomLinkComponent {
 *   readonly href = input<string>();
 *   readonly children = input<AngularRenderNode[]>([]);
 * }
 * ```
 */
@Component({
  selector: 'sb-rich-text-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [NgComponentOutlet],
  template: `
    @if (componentType()) {
      <ng-container *ngComponentOutlet="componentType(); inputs: componentInputs()" />
    }
  `,
  styles: [
    `
      sb-rich-text-node {
        display: contents;
      }
    `,
  ],
})
export class SbRichTextNodeComponent implements OnInit, OnDestroy {
  private readonly resolver = inject(StoryblokRichtextResolver);
  private readonly renderer = inject(Renderer2);
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);
  private readonly envInjector = inject(EnvironmentInjector);
  private readonly appRef = inject(ApplicationRef);

  /** Track dynamically created child components for cleanup */
  private readonly childComponentRefs: ComponentRef<SbRichTextNodeComponent>[] = [];

  /** The AST node to render */
  readonly node = input.required<AngularRenderNode>();

  /** Resolved component type (supports lazy loading) */
  readonly componentType = signal<Type<unknown> | null>(null);

  /**
   * The inputs to pass to the dynamic component.
   * Includes all props from the node plus children array.
   */
  readonly componentInputs = computed<Record<string, unknown>>(() => {
    const node = this.node();
    if (!isComponentNode(node)) return {};
    return {
      ...node.props,
      children: node.children ?? [],
    };
  });

  ngOnInit(): void {
    const node = this.node();
    const hostElement = this.el.nativeElement;

    // Safety check for SSR - ensure we have a valid DOM element
    if (!hostElement) {
      return;
    }

    // Handle text nodes
    if (isTextNode(node)) {
      this.renderTextNode(node, hostElement);
      return;
    }

    // Handle HTML tag nodes
    if (isTagNode(node)) {
      this.renderTagNode(node, hostElement);
      return;
    }

    // Handle component nodes
    if (isComponentNode(node)) {
      this.resolveAndRenderComponent(node, hostElement);
    }
  }

  ngOnDestroy(): void {
    // Clean up all dynamically created child components
    for (const ref of this.childComponentRefs) {
      this.appRef.detachView(ref.hostView);
      ref.destroy();
    }
    this.childComponentRefs.length = 0;
  }

  /**
   * Resolves and renders a component node, handling both eager and lazy loading.
   */
  private resolveAndRenderComponent(
    node: { component: string; props: Record<string, unknown>; children?: AngularRenderNode[] },
    hostElement: HTMLElement,
  ): void {
    // Try synchronous resolution first (eager or cached)
    const syncComponent = this.resolver.getSync(node.component as any);

    if (syncComponent) {
      this.componentType.set(syncComponent);
      return;
    }

    // Check if the component is registered at all
    if (!this.resolver.has(node.component as any)) {
      // No component registered - render children as fallback
      this.renderChildren(node.children ?? [], hostElement);
      return;
    }

    // Lazy component - resolve asynchronously
    this.resolver.resolve(node.component as any).then((component) => {
      if (component) {
        this.componentType.set(component);
      } else {
        // Fallback: render children if component couldn't be resolved
        this.renderChildren(node.children ?? [], hostElement);
      }
    });
  }

  /**
   * Renders a text node by creating a text DOM node.
   */
  private renderTextNode(text: string, parent: HTMLElement): void {
    const textNode = this.renderer.createText(text);
    this.renderer.appendChild(parent, textNode);
  }

  /**
   * Renders an HTML tag node by creating a DOM element with attributes.
   */
  private renderTagNode(
    node: {
      tag: string;
      attrs?: Record<string, unknown>;
      children?: AngularRenderNode[];
    },
    parent: HTMLElement,
  ): void {
    const element = this.renderer.createElement(node.tag);

    // Apply attributes
    if (node.attrs) {
      this.applyAttributes(element, node.attrs);
    }

    // Append to parent element
    this.renderer.appendChild(parent, element);

    // Render children inside the element (skip for void elements like img, br, hr)
    if (!isVoidElement(node.tag) && node.children?.length) {
      this.renderChildren(node.children, element);
    }
  }

  /**
   * Recursively renders child nodes by creating SbRichTextNodeComponent instances.
   * Uses createComponent from @angular/core for proper SSR support.
   */
  private renderChildren(children: AngularRenderNode[], parent: HTMLElement | Element): void {
    for (const child of children) {
      // Create the component using Angular's createComponent
      const componentRef = createComponent(SbRichTextNodeComponent, {
        environmentInjector: this.envInjector,
        elementInjector: this.injector,
      });

      // Track for cleanup
      this.childComponentRefs.push(componentRef);

      // Set the input
      componentRef.setInput('node', child);

      // Attach to application for change detection
      this.appRef.attachView(componentRef.hostView);

      // Append the component's native element to the parent
      const childElement = componentRef.location.nativeElement;
      this.renderer.appendChild(parent, childElement);

      // Trigger change detection
      componentRef.changeDetectorRef.detectChanges();
    }
  }

  /**
   * Applies attributes to an element, handling special cases for style and class.
   */
  private applyAttributes(element: Element, attrs: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === undefined || value === null) continue;

      if (key === 'style') {
        this.applyStyle(element, value);
      } else if (key === 'class') {
        this.renderer.setAttribute(element, 'class', String(value));
      } else {
        this.renderer.setAttribute(element, key, String(value));
      }
    }
  }

  /**
   * Applies style to an element, handling both string and object formats.
   */
  private applyStyle(element: Element, style: unknown): void {
    if (typeof style === 'string') {
      this.renderer.setAttribute(element, 'style', style);
    } else if (typeof style === 'object' && style !== null) {
      for (const [prop, val] of Object.entries(style as Record<string, string>)) {
        this.renderer.setStyle(element, prop, val);
      }
    }
  }
}
