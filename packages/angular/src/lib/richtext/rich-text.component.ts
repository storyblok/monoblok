import {
  Component,
  ChangeDetectionStrategy,
  input,
  inject,
  ElementRef,
  Renderer2,
  OnDestroy,
  ViewEncapsulation,
  createComponent,
  effect,
  ApplicationRef,
  EnvironmentInjector,
  untracked,
  createEnvironmentInjector,
} from '@angular/core';
import {
  buildStoryblokImage,
  getInnerMarks,
  getStaticChildren,
  groupLinkNodes,
  isSelfClosing,
  normalizeNodes,
  processAttrs,
  resolveTag,
  splitTableRows,
} from '@storyblok/richtext';
import type {
  SbRichTextNode,
  SbRichTextMark,
  RenderSpec,
  SbRichTextElement,
  SbRichTextInput,
  SbRichTextImageOptions,
} from '@storyblok/richtext';
import { StoryblokComponent } from '../blok/sb-component.component';
import {
  StoryblokRichtextResolver,
  STORYBLOK_RICHTEXT_EXCLUDED_TYPES,
  type SbAngularRichTextRenderContext,
} from './richtext.feature';

@Component({
  selector: 'sb-rich-text',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: ``,
  host: { style: 'display: contents' },
})
export class SbRichTextComponent implements OnDestroy {
  /** Input richtext document or array of documents */
  sbDocument = input.required<SbRichTextInput>();

  /**
   * Enable image optimization for Storyblok images.
   * When `true`, applies default optimization. Pass an options object for fine-grained control.
   *
   * @example
   * ```html
   * <!-- Enable default optimization -->
   * <sb-rich-text [sbDocument]="doc" [sbOptimizeImage]="true" />
   *
   * <!-- Custom optimization options -->
   * <sb-rich-text [sbDocument]="doc" [sbOptimizeImage]="{ width: 800, loading: 'lazy' }" />
   * ```
   */
  sbOptimizeImage = input<boolean | Partial<SbRichTextImageOptions>>(false);

  /**
   * Arbitrary data forwarded to every custom node/mark component via their `context` input.
   * Use this to pass application state (e.g. locale, theme, user data) into richtext renderers
   * without prop-drilling through the document tree.
   *
   * @example
   * ```html
   * <sb-rich-text [sbDocument]="doc" [sbData]="{ prefix: '[draft]' }" />
   * ```
   */
  sbData = input<unknown>();

  private readonly renderer = inject(Renderer2);
  private readonly hostElement: HTMLElement = inject(ElementRef).nativeElement;
  private readonly appRef = inject(ApplicationRef);
  private readonly envInjector = inject(EnvironmentInjector);
  private readonly resolver = inject(StoryblokRichtextResolver);
  private readonly excludedTypes = inject(STORYBLOK_RICHTEXT_EXCLUDED_TYPES);

  /** Prevent async work after destroy */
  private destroyed = false;

  /** Render version for async cancellation */
  private renderVersion = 0;

  /** Cache resolved components (node + marks) */
  private readonly componentCache = new Map<string, any>();

  /** Track dynamically created components */
  private readonly componentRefs: any[] = [];

  /** Track child EnvironmentInjectors created for loop prevention */
  private readonly childInjectors: EnvironmentInjector[] = [];

  constructor() {
    // Use effect to reactively render when doc or optimizeImage changes
    // The effect runs synchronously during change detection, making it SSR-compatible
    effect(() => {
      const sbDocument = this.sbDocument();
      const _optimizeImage = this.sbOptimizeImage(); // Track for reactivity
      const _data = this.sbData(); // Track for reactivity
      // Use untracked to avoid re-triggering the effect when calling render
      untracked(() => this.render(sbDocument));
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.clearContent();

    // destroy all dynamically created components
    for (const ref of this.componentRefs) {
      ref.destroy();
    }
    this.componentRefs.length = 0;

    // destroy child injectors created for loop prevention
    for (const injector of this.childInjectors) {
      injector.destroy();
    }
    this.childInjectors.length = 0;
  }

  // --------------------------------------------------
  // Render entry
  // --------------------------------------------------
  private render(sbDocument: SbRichTextInput): void {
    const version = ++this.renderVersion;
    const nodes = normalizeNodes(sbDocument, true);
    this.clearContent();

    if (!nodes.length) return;

    this.renderChildren(nodes, this.hostElement, version);
  }

  /**
   * Renders child nodes with link mark merging.
   * Adjacent text nodes with the same link mark are grouped under a single anchor element.
   */
  private renderChildren(children: SbRichTextNode[], parent: HTMLElement, version: number): void {
    const groups = groupLinkNodes(children);

    for (const group of groups) {
      if (this.shouldAbort(version)) return;
      if (group.linkMark) {
        this.renderLinkGroup(group.nodes, group.linkMark, parent, version);
      } else {
        this.renderNode(group.nodes[0], parent, version);
      }
    }
  }

  /**
   * Renders a group of text nodes that share the same link mark.
   * Creates a single anchor element containing all the text nodes with their inner marks.
   */
  private renderLinkGroup(
    nodes: SbRichTextNode[],
    linkMark: SbRichTextMark,
    parent: HTMLElement,
    version: number,
  ): void {
    // Check if link mark has a custom component
    const CustomLink = this.resolver.getSync(linkMark.type);

    if (CustomLink) {
      // For custom link components, render each text node separately
      // since we can't easily project multiple nodes into ng-content
      for (const node of nodes) {
        this.renderTextNode(node as SbRichTextNode & { type: 'text' }, parent, version);
      }
      return;
    }

    const tag = resolveTag(linkMark);
    if (!tag) {
      for (const node of nodes) {
        this.renderTextNode(node as SbRichTextNode & { type: 'text' }, parent, version);
      }
      return;
    }

    const linkEl = this.renderer.createElement(tag);
    this.applyAttributes(linkEl, processAttrs(linkMark.type, linkMark.attrs));

    // Render each text node with only its inner marks (excluding the link mark)
    for (const node of nodes) {
      if (node.type !== 'text') continue;

      const innerMarks = getInnerMarks(node);
      let current: Node = this.renderer.createText(node.text || '');

      for (const mark of innerMarks) {
        const CustomMark = this.resolver.getSync(mark.type);

        if (CustomMark) {
          const ref = createComponent(CustomMark, {
            environmentInjector: this.envInjector,
            projectableNodes: [[current]],
          });

          ref.setInput('data', mark);
          try { ref.setInput('context', this.getContext()); } catch { /* context input not declared */ }
          this.appRef.attachView(ref.hostView);
          this.componentRefs.push(ref);

          current = (ref.hostView as any).rootNodes[0];
          continue;
        }

        const markTag = resolveTag(mark);
        if (!markTag) continue;

        const el = this.renderer.createElement(markTag);
        this.applyAttributes(el, processAttrs(mark.type, mark.attrs));
        this.renderer.appendChild(el, current);
        current = el;
      }

      this.renderer.appendChild(linkEl, current);
    }

    this.renderer.appendChild(parent, linkEl);
  }

  // --------------------------------------------------
  // Node renderer (synchronous with deferred async for custom components)
  // --------------------------------------------------
  private renderNode(node: SbRichTextNode, parent: HTMLElement, version: number): void {
    if (this.shouldAbort(version)) return;

    if (node.type === 'text') {
      // Check for a custom text component before falling back to native rendering.
      // Skip if this type is excluded (loop prevention).
      if (!this.excludedTypes.has('text')) {
        const syncTextComponent = this.resolver.getSync('text');
        if (syncTextComponent) {
          const anchor = this.renderer.createComment('sb-node');
          this.renderer.appendChild(parent, anchor);
          this.mountComponent(syncTextComponent, { data: node }, parent, anchor, 'text');
          return;
        }

        if (this.resolver.has('text')) {
          const anchor = this.renderer.createComment('sb-node');
          this.renderer.appendChild(parent, anchor);
          this.resolveAndMount(node, parent, anchor, version);
          return;
        }
      }

      this.renderTextNode(node, parent, version);
      return;
    }

    // Try to get cached or eagerly loaded component synchronously first.
    // Skip if this type is excluded (loop prevention).
    const syncComponent = !this.excludedTypes.has(node.type)
      ? this.resolver.getSync(node.type)
      : null;

    if (syncComponent) {
      const anchor = this.renderer.createComment('sb-node');
      this.renderer.appendChild(parent, anchor);
      this.mountComponent(syncComponent, { data: node }, parent, anchor, node.type);
      return;
    }

    // Check if this type has an async loader registered (and is not excluded)
    if (!this.excludedTypes.has(node.type) && this.resolver.has(node.type)) {
      const anchor = this.renderer.createComment('sb-node');
      this.renderer.appendChild(parent, anchor);
      this.resolveAndMount(node, parent, anchor, version);
      return;
    }

    // -------------------------
    // Blok fallback
    // -------------------------
    if (node.type === 'blok') {
      const blokList = node.attrs?.body;
      if (!blokList?.length) return;

      const anchor = this.renderer.createComment('sb-node');
      this.renderer.appendChild(parent, anchor);
      this.mountComponent(StoryblokComponent, { sbBlok: blokList }, parent, anchor);
      return;
    }

    // -------------------------
    // Native HTML node (synchronous)
    // -------------------------
    const tag = resolveTag(node);

    // No tag (e.g., nested doc): render children directly
    if (!tag) {
      if (node.content) {
        this.renderChildren(node.content, parent, version);
      }
      return;
    }

    // Handle image optimization
    if (node.type === 'image' && this.sbOptimizeImage()) {
      this.renderOptimizedImage(node, parent);
      return;
    }

    const el = this.renderer.createElement(tag);
    const attrs = processAttrs(node.type, node.attrs);

    const staticChildren = getStaticChildren(node);

    if (!staticChildren) {
      this.applyAttributes(el, attrs);
    }

    if (!isSelfClosing(tag)) {
      if (node.type === 'table' && node.content) {
        this.renderTableContent(node.content, el, version);
      } else {
        const contentHost = staticChildren
          ? this.createStaticScaffold(staticChildren, el, attrs)
          : el;

        if (node.content) {
          this.renderChildren(node.content, contentHost, version);
        }
      }
    }

    this.renderer.appendChild(parent, el);
  }

  /**
   * Renders an image node with Storyblok image optimization applied.
   */
  private renderOptimizedImage(node: SbRichTextNode, parent: HTMLElement): void {
    const attrs = node.attrs as Record<string, unknown> | undefined;
    const src = attrs?.['src'] as string | undefined;

    if (!src) {
      return;
    }

    const { src: optimizedSrc, attrs: extraAttrs } = buildStoryblokImage(src, this.sbOptimizeImage());

    const finalAttrs = processAttrs('image', {
      ...attrs,
      src: optimizedSrc,
      ...extraAttrs,
    });

    const el = this.renderer.createElement('img');
    this.applyAttributes(el, finalAttrs);
    this.renderer.appendChild(parent, el);
  }

  /**
   * Renders table content with proper thead/tbody grouping.
   * Header rows (containing only tableHeader cells) go in thead,
   * remaining rows go in tbody.
   */
  private renderTableContent(rows: SbRichTextNode[], tableEl: HTMLElement, version: number): void {
    const { headerRows, bodyRows } = splitTableRows(rows);

    if (headerRows.length > 0) {
      const thead = this.renderer.createElement('thead');
      for (const row of headerRows) {
        this.renderNode(row, thead, version);
      }
      this.renderer.appendChild(tableEl, thead);
    }

    if (bodyRows.length > 0) {
      const tbody = this.renderer.createElement('tbody');
      for (const row of bodyRows) {
        this.renderNode(row, tbody, version);
      }
      this.renderer.appendChild(tableEl, tbody);
    }
  }

  /** Async resolution and mounting for lazy-loaded components */
  private async resolveAndMount(
    node: SbRichTextNode,
    parent: HTMLElement,
    anchor: Node,
    version: number,
  ): Promise<void> {
    const CustomNode = await this.resolveCached(node.type as SbRichTextElement);
    if (this.shouldAbort(version, anchor)) return;

    const parentNode = anchor.parentNode as HTMLElement;
    if (!this.isValidAnchor(anchor, parentNode)) return;

    if (CustomNode) {
      this.mountComponent(CustomNode, { data: node }, parentNode, anchor, node.type);
    } else {
      this.renderer.removeChild(parentNode, anchor);
    }
  }

  // --------------------------------------------------
  // Text renderer (marks) - synchronous
  // --------------------------------------------------
  private renderTextNode(
    node: SbRichTextNode & { type: 'text' },
    parent: HTMLElement,
    version: number,
  ): void {
    const marks = node.marks ?? [];

    // Check if any marks need async resolution
    const hasAsyncMarks = marks.some(
      (mark) => !this.resolver.getSync(mark.type) && this.resolver.has(mark.type),
    );

    if (hasAsyncMarks) {
      // Create placeholder anchor to preserve position in parent
      const anchor = this.renderer.createComment('sb-text');
      this.renderer.appendChild(parent, anchor);
      this.renderTextNodeAsync(node, parent, anchor, version);
      return;
    }

    // Synchronous rendering for native marks and cached custom marks
    let current: Node = this.renderer.createText(node.text || '');

    for (const mark of marks) {
      const CustomMark = this.resolver.getSync(mark.type);

      if (CustomMark) {
        const ref = createComponent(CustomMark, {
          environmentInjector: this.envInjector,
          projectableNodes: [[current]],
        });

        ref.setInput('data', mark);
        try { ref.setInput('context', this.getContext()); } catch { /* context input not declared */ }
        this.appRef.attachView(ref.hostView);

        this.componentRefs.push(ref);

        current = (ref.hostView as any).rootNodes[0];
        continue;
      }

      const tag = resolveTag(mark);
      if (!tag) continue;

      const el = this.renderer.createElement(tag);
      this.applyAttributes(el, processAttrs(mark.type, mark.attrs));

      this.renderer.appendChild(el, current);
      current = el;
    }

    this.renderer.appendChild(parent, current);
  }

  /** Async text node rendering for lazy-loaded mark components */
  private async renderTextNodeAsync(
    node: SbRichTextNode & { type: 'text' },
    parent: HTMLElement,
    anchor: Node,
    version: number,
  ): Promise<void> {
    let current: Node = this.renderer.createText(node.text || '');

    for (const mark of node.marks ?? []) {
      const CustomMark = await this.resolveCached(mark.type);
      if (this.shouldAbort(version)) return;

      if (CustomMark) {
        const ref = createComponent(CustomMark, {
          environmentInjector: this.envInjector,
          projectableNodes: [[current]],
        });

        ref.setInput('data', mark);
        try { ref.setInput('context', this.getContext()); } catch { /* context input not declared */ }
        this.appRef.attachView(ref.hostView);

        this.componentRefs.push(ref);

        current = (ref.hostView as any).rootNodes[0];
        continue;
      }

      const tag = resolveTag(mark);
      if (!tag) continue;

      const el = this.renderer.createElement(tag);
      this.applyAttributes(el, processAttrs(mark.type, mark.attrs));

      this.renderer.appendChild(el, current);
      current = el;
    }

    // Insert at the anchor position to maintain correct order
    this.renderer.insertBefore(parent, current, anchor);
    this.renderer.removeChild(parent, anchor);
  }

  // --------------------------------------------------
  // Helpers
  // --------------------------------------------------

  /** Prevent rendering after destroy or version mismatch */
  private shouldAbort(version: number, anchor?: Node): boolean {
    if (this.destroyed || version !== this.renderVersion) {
      return true;
    }

    if (anchor && !anchor.parentNode) {
      return true;
    }

    return false;
  }

  /** Resolve component with caching */
  private async resolveCached(type: SbRichTextElement): Promise<any> {
    if (this.componentCache.has(type)) {
      return this.componentCache.get(type);
    }

    const resolved = await this.resolver.resolve(type);
    this.componentCache.set(type, resolved);

    return resolved;
  }

  /** Build the render context forwarded to every custom component's `context` input. */
  private getContext(): SbAngularRichTextRenderContext {
    const optimizeImage = this.sbOptimizeImage();
    const ctx: SbAngularRichTextRenderContext = { data: this.sbData() };
    if (optimizeImage) ctx.optimizeImage = optimizeImage;
    return ctx;
  }

  /** Mount dynamic component safely */
  private mountComponent(
    Component: any,
    inputs: Record<string, unknown>,
    parent: HTMLElement,
    anchor: Node,
    excludeType?: string,
  ) {
    if (this.destroyed) return;

    // When a custom component is mounted for a given type, create a child
    // EnvironmentInjector that marks that type as excluded.  Any <sb-rich-text>
    // rendered inside the custom component's template will inherit this injector
    // and fall back to native HTML for that type, preventing infinite loops.
    let injector = this.envInjector;
    if (excludeType) {
      injector = createEnvironmentInjector(
        [{ provide: STORYBLOK_RICHTEXT_EXCLUDED_TYPES, useValue: new Set([...this.excludedTypes, excludeType]) }],
        this.envInjector,
      );
      this.childInjectors.push(injector);
    }

    const ref = createComponent(Component, {
      environmentInjector: injector,
    });

    Object.entries(inputs).forEach(([k, v]) => ref.setInput(k, v));

    // Forward render context (sbData, optimizeImage) if the component declares a context input.
    // setInput throws for undeclared inputs, so we catch and ignore it silently.
    try {
      ref.setInput('context', this.getContext());
    } catch {
      // Component does not declare a context input — skip.
    }

    this.appRef.attachView(ref.hostView);
    this.componentRefs.push(ref);

    const nodes = (ref.hostView as any).rootNodes;
    for (const n of nodes) {
      this.renderer.insertBefore(parent, n, anchor);
    }

    this.renderer.removeChild(parent, anchor);
  }

  private applyAttributes(el: HTMLElement, attrs: Record<string, unknown> = {}) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;

      if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) {
          this.renderer.setStyle(el, sk, String(sv));
        }
      } else {
        this.renderer.setAttribute(el, k, String(v));
      }
    }
  }

  private createStaticScaffold(
    specs: readonly RenderSpec[],
    parent: HTMLElement,
    attrs: Record<string, unknown> = {},
  ): HTMLElement {
    let host = parent;

    for (const spec of specs) {
      const el = this.renderer.createElement(spec.tag);
      this.applyAttributes(el, { ...spec.attrs, ...attrs });

      this.renderer.appendChild(host, el);
      host = spec.children ? this.createStaticScaffold(spec.children, el) : el;
    }

    return host;
  }

  private isValidAnchor(anchor: Node | null | undefined, parent: Node): anchor is Node {
    return !!anchor && anchor.parentNode === parent;
  }

  private clearContent(): void {
    while (this.hostElement.firstChild) {
      this.renderer.removeChild(this.hostElement, this.hostElement.firstChild);
    }
  }
}
