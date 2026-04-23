import {
  Component,
  ChangeDetectionStrategy,
  input,
  inject,
  ElementRef,
  Renderer2,
  AfterViewInit,
  OnDestroy,
  ViewEncapsulation,
  createComponent,
  effect,
  signal,
  DestroyRef,
  ApplicationRef,
  EnvironmentInjector,
} from '@angular/core';
import {
  getStaticChildren,
  isSelfClosing,
  processAttrs,
  resolveTag,
} from '@storyblok/richtext/static';
import type {
  RenderSpec,
  StoryblokRichTextJson,
  TiptapComponentName,
} from '@storyblok/richtext/static';
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
export class SbRichTextComponent implements AfterViewInit, OnDestroy {
  /** Input richtext document */
  doc = input.required<StoryblokRichTextJson | null | undefined>();

  private readonly renderer = inject(Renderer2);
  private readonly hostElement: HTMLElement = inject(ElementRef).nativeElement;
  private readonly destroyRef = inject(DestroyRef);
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

  private readonly hasRendered = signal(false);

  constructor() {
    effect(() => {
      if (!this.hasRendered()) return;
      this.render(this.doc());
    });
  }

  ngAfterViewInit(): void {
    if (this.hostElement.childNodes.length === 0) {
      this.render(this.doc());
    }
    this.hasRendered.set(true);
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
  private render(doc: StoryblokRichTextJson | null | undefined): void {
    const version = ++this.renderVersion;

    this.clearContent();
    if (!doc) return;

    const nodes = doc.type === 'doc' && doc.content ? doc.content : [doc];

    for (const node of nodes) {
      this.renderNode(node, this.hostElement, version);
    }
  }

  // --------------------------------------------------
  // Node renderer
  // --------------------------------------------------
  private async renderNode(
    node: StoryblokRichTextJson,
    parent: HTMLElement,
    version: number,
  ): Promise<void> {
    if (this.shouldAbort(version)) return;

    if (node.type === 'text') {
      await this.renderTextNode(node, parent, version);
      return;
    }

    const anchor = this.renderer.createComment('sb-node');
    this.renderer.appendChild(parent, anchor);

    const CustomNode = await this.resolveCached(node.type);
    if (this.shouldAbort(version, anchor)) return;

    const parentNode = anchor.parentNode as HTMLElement;
    if (!this.isValidAnchor(anchor, parentNode)) return;
    // -------------------------
    // Custom component
    // -------------------------
    if (CustomNode) {
      this.mountComponent(CustomNode, { data: node }, parentNode, anchor);
      return;
    }

    // -------------------------
    // Blok fallback
    // -------------------------
    if (node.type === 'blok') {
      const blokList = node.attrs?.body;
      if (!blokList?.length) {
        this.renderer.removeChild(parentNode, anchor);
        return;
      }

      this.mountComponent(StoryblokComponent, { bloks: blokList }, parentNode, anchor);
      return;
    }

    // -------------------------
    // Native HTML node
    // -------------------------
    const tag = resolveTag(node);
    if (!tag) {
      this.renderer.removeChild(parentNode, anchor);
      return;
    }

    const el = this.renderer.createElement(tag);
    const attrs = processAttrs(node.type, node.attrs);

    const staticChildren = getStaticChildren(node);

    if (!staticChildren) {
      this.applyAttributes(el, attrs);
    }

    if (!isSelfClosing(tag)) {
      const contentHost = staticChildren
        ? this.createStaticScaffold(staticChildren, el, attrs)
        : el;

      if (node.content) {
        for (const child of node.content) {
          await this.renderNode(child, contentHost, version);
        }
      }
    }

    this.renderer.insertBefore(parentNode, el, anchor);
    this.renderer.removeChild(parentNode, anchor);
  }

  // --------------------------------------------------
  // Text renderer (marks)
  // --------------------------------------------------
  private async renderTextNode(
    node: StoryblokRichTextJson & { type: 'text' },
    parent: HTMLElement,
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

    this.renderer.appendChild(parent, current);
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
  private async resolveCached(type: TiptapComponentName): Promise<any> {
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
