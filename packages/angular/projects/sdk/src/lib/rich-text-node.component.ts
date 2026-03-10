import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
  ElementRef,
  Renderer2,
  OnInit,
  Type,
  ViewContainerRef,
  ViewEncapsulation,
  Injector,
  createComponent,
  EnvironmentInjector,
  ApplicationRef,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import {
  STORYBLOK_RICHTEXT_COMPONENTS,
  type AngularRenderNode,
  isTextNode,
  isTagNode,
  isComponentNode,
} from './richtext.feature';

/**
 * Self-closing HTML elements that don't have children.
 */
const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

/**
 * Recursively renders a single rich text AST node.
 *
 * This component handles three types of nodes:
 * - **Text nodes**: Rendered as plain text
 * - **Tag nodes**: Rendered as HTML elements with attributes
 * - **Component nodes**: Rendered using custom Angular components
 *
 * The component uses Angular's `Renderer2` for SSR-safe DOM manipulation.
 *
 * @internal This component is used internally by `RichTextComponent`.
 * Users typically don't need to use this directly, but it's exported
 * for custom component implementations that need to render children.
 *
 * @example Rendering children in a custom component
 * ```typescript
 * @Component({
 *   selector: 'app-custom-link',
 *   imports: [RichTextNodeComponent],
 *   template: `
 *     <a [href]="href()">
 *       @for (child of children(); track $index) {
 *         <sb-richtext-node [node]="child" />
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
  selector: 'sb-richtext-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [NgComponentOutlet],
  template: `
    @if (isComponentWithType()) {
      <ng-container *ngComponentOutlet="componentType(); inputs: componentInputs()" />
    }
  `,
  styles: [
    `
      sb-richtext-node {
        display: contents;
      }
    `,
  ],
})
export class RichTextNodeComponent implements OnInit {
  private readonly components = inject(STORYBLOK_RICHTEXT_COMPONENTS);
  private readonly renderer = inject(Renderer2);
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);
  private readonly envInjector = inject(EnvironmentInjector);
  private readonly appRef = inject(ApplicationRef);

  /** The AST node to render */
  readonly node = input.required<AngularRenderNode>();

  /**
   * Whether this is a component node with a registered component type.
   * Used to conditionally render the ngComponentOutlet in the template.
   */
  readonly isComponentWithType = computed(() => {
    const node = this.node();
    if (!isComponentNode(node)) return false;
    return this.components[node.component] != null;
  });

  /**
   * The Angular component type to render for component nodes.
   */
  readonly componentType = computed<Type<unknown> | null>(() => {
    const node = this.node();
    if (!isComponentNode(node)) return null;
    return this.components[node.component] ?? null;
  });

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

    // Handle component nodes without a registered component (fallback: render children)
    if (isComponentNode(node) && !this.componentType()) {
      this.renderChildren(node.children ?? [], hostElement);
    }
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

    // Render children inside the element (skip for void elements)
    if (!VOID_ELEMENTS.has(node.tag) && node.children?.length) {
      this.renderChildren(node.children, element);
    }
  }

  /**
   * Recursively renders child nodes by creating RichTextNodeComponent instances.
   * Uses createComponent from @angular/core for proper SSR support.
   */
  private renderChildren(children: AngularRenderNode[], parent: HTMLElement | Element): void {
    for (const child of children) {
      // Create the component using Angular's createComponent
      const componentRef = createComponent(RichTextNodeComponent, {
        environmentInjector: this.envInjector,
        elementInjector: this.injector,
      });

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
