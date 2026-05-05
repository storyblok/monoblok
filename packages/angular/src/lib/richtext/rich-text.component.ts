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
} from '@angular/core';
import {
  getInnerMarks,
  getStaticChildren,
  groupLinkNodes,
  isSelfClosing,
  processAttrs,
  resolveTag,
  splitTableRows,
} from '@storyblok/richtext/static';
import type { PMMark, RenderSpec, SbRichTextDoc, SbRichTextElement } from '@storyblok/richtext/static';
import { StoryblokComponent } from '../blok/sb-component.component';
import { StoryblokRichtextResolver } from './richtext.feature';

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
  sbDocument = input.required<SbRichTextDoc | SbRichTextDoc[] | null | undefined>();

  private readonly renderer = inject(Renderer2);
  private readonly hostElement: HTMLElement = inject(ElementRef).nativeElement;
  private readonly appRef = inject(ApplicationRef);
  private readonly envInjector = inject(EnvironmentInjector);
  private readonly resolver = inject(StoryblokRichtextResolver);

  /** Prevent async work after destroy */
  private destroyed = false;

  /** Render version for async cancellation */
  private renderVersion = 0;

  /** Cache resolved components (node + marks) */
  private readonly componentCache = new Map<string, any>();

  /** Track dynamically created components */
  private readonly componentRefs: any[] = [];

  constructor() {
    // Use effect to reactively render when doc changes
    // The effect runs synchronously during change detection, making it SSR-compatible
    effect(() => {
      const sbDocument = this.sbDocument();
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
  }

  // --------------------------------------------------
  // Render entry
  // --------------------------------------------------
  private render(sbDocument: SbRichTextDoc | SbRichTextDoc[] | null | undefined): void {
    const version = ++this.renderVersion;

    this.clearContent();
    if (!sbDocument) return;

    // Handle array of documents
    if (Array.isArray(sbDocument)) {
      for (const doc of sbDocument) {
        this.renderSingleDocument(doc, version);
      }
      return;
    }

    this.renderSingleDocument(sbDocument, version);
  }

  /** Render a single document */
  private renderSingleDocument(doc: SbRichTextDoc, version: number): void {
    const nodes = doc.type === 'doc' && doc.content ? doc.content : [doc];
    this.renderChildren(nodes, this.hostElement, version);
  }

  /**
   * Renders child nodes with link mark merging.
   * Adjacent text nodes with the same link mark are grouped under a single anchor element.
   */
  private renderChildren(children: SbRichTextDoc[], parent: HTMLElement, version: number): void {
    const groups = groupLinkNodes(children);

    for (const group of groups) {
      if (this.shouldAbort(version)) return;

      if (group.linkMark) {
        // Render grouped text nodes under a single link
        this.renderLinkGroup(group.nodes, group.linkMark, parent, version);
      } else {
        // Render single node normally
        this.renderNode(group.nodes[0], parent, version);
      }
    }
  }

  /**
   * Renders a group of text nodes that share the same link mark.
   * Creates a single anchor element containing all the text nodes with their inner marks.
   */
  private renderLinkGroup(
    nodes: SbRichTextDoc[],
    linkMark: PMMark,
    parent: HTMLElement,
    version: number,
  ): void {
    // Check if link mark has a custom component
    const CustomLink = this.resolver.getSync(linkMark.type);

    if (CustomLink) {
      // For custom link components, render each text node separately
      // since we can't easily project multiple nodes into ng-content
      for (const node of nodes) {
        this.renderTextNode(node as SbRichTextDoc & { type: 'text' }, parent, version);
      }
      return;
    }

    // Create the link element
    const tag = resolveTag(linkMark);
    if (!tag) {
      // No tag, render text nodes directly
      for (const node of nodes) {
        this.renderTextNode(node as SbRichTextDoc & { type: 'text' }, parent, version);
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

      // Apply inner marks
      for (const mark of innerMarks) {
        const CustomMark = this.resolver.getSync(mark.type);

        if (CustomMark) {
          const ref = createComponent(CustomMark, {
            environmentInjector: this.envInjector,
            projectableNodes: [[current]],
          });

          ref.setInput('data', mark);
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
  private renderNode(node: SbRichTextDoc, parent: HTMLElement, version: number): void {
    if (this.shouldAbort(version)) return;

    if (node.type === 'text') {
      this.renderTextNode(node, parent, version);
      return;
    }

    // Try to get cached or eagerly loaded component synchronously first
    const syncComponent = this.resolver.getSync(node.type);

    if (syncComponent) {
      // Custom component available synchronously
      const anchor = this.renderer.createComment('sb-node');
      this.renderer.appendChild(parent, anchor);
      this.mountComponent(syncComponent, { data: node }, parent, anchor);
      return;
    }

    // Check if this type has an async loader registered
    if (this.resolver.has(node.type)) {
      // Create placeholder and resolve async
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

    const el = this.renderer.createElement(tag);
    const attrs = processAttrs(node.type, node.attrs);

    const staticChildren = getStaticChildren(node);

    if (!staticChildren) {
      this.applyAttributes(el, attrs);
    }

    if (!isSelfClosing(tag)) {
      // Special handling for tables: group rows into thead/tbody
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
   * Renders table content with proper thead/tbody grouping.
   * Header rows (containing only tableHeader cells) go in thead,
   * remaining rows go in tbody.
   */
  private renderTableContent(
    rows: SbRichTextDoc[],
    tableEl: HTMLElement,
    version: number,
  ): void {
    const { headerRows, bodyRows } = splitTableRows(rows);

    // Render thead if there are header rows
    if (headerRows.length > 0) {
      const thead = this.renderer.createElement('thead');
      for (const row of headerRows) {
        this.renderNode(row, thead, version);
      }
      this.renderer.appendChild(tableEl, thead);
    }

    // Render tbody if there are body rows
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
    node: SbRichTextDoc,
    parent: HTMLElement,
    anchor: Node,
    version: number,
  ): Promise<void> {
    // node.type is guaranteed to not be 'text' since text nodes are handled separately
    const CustomNode = await this.resolveCached(node.type as SbRichTextElement);
    if (this.shouldAbort(version, anchor)) return;

    const parentNode = anchor.parentNode as HTMLElement;
    if (!this.isValidAnchor(anchor, parentNode)) return;

    if (CustomNode) {
      this.mountComponent(CustomNode, { data: node }, parentNode, anchor);
    } else {
      this.renderer.removeChild(parentNode, anchor);
    }
  }

  // --------------------------------------------------
  // Text renderer (marks) - synchronous
  // --------------------------------------------------
  private renderTextNode(
    node: SbRichTextDoc & { type: 'text' },
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
    node: SbRichTextDoc & { type: 'text' },
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

  /** Mount dynamic component safely */
  private mountComponent(
    Component: any,
    inputs: Record<string, unknown>,
    parent: HTMLElement,
    anchor: Node,
  ) {
    if (this.destroyed) return;

    const ref = createComponent(Component, {
      environmentInjector: this.envInjector,
    });

    Object.entries(inputs).forEach(([k, v]) => ref.setInput(k, v));

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
