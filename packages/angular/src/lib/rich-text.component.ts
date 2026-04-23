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
import type { RenderSpec, StoryblokRichTextJson } from '@storyblok/richtext/static';
import { StoryblokComponent } from './rich-componnet.component';
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
  doc = input.required<StoryblokRichTextJson | null | undefined>();

  private readonly renderer = inject(Renderer2);
  private readonly hostElement: HTMLElement = inject(ElementRef).nativeElement;
  private readonly destroyRef = inject(DestroyRef);
  private readonly appRef = inject(ApplicationRef);
  private readonly envInjector = inject(EnvironmentInjector);
  private readonly resolver = inject(StoryblokRichtextResolver);

  private readonly hasRendered = signal(false);
  private renderVersion = 0;

  constructor() {
    effect(() => {
      const doc = this.doc();
      if (!this.hasRendered()) return;
      this.render(doc);
    });
  }

  ngAfterViewInit(): void {
    if (this.hostElement.childNodes.length > 0) {
      this.hasRendered.set(true);
      return;
    }

    this.render(this.doc());
    this.hasRendered.set(true);
  }

  ngOnDestroy(): void {
    this.clearContent();
  }

  // -----------------------------
  // Core Render
  // -----------------------------
  private render(doc: StoryblokRichTextJson | null | undefined): void {
    const version = ++this.renderVersion;

    this.clearContent();
    if (!doc) return;

    const nodes = doc.type === 'doc' && doc.content ? doc.content : [doc];
    for (const node of nodes) {
      this.renderNode(node, this.hostElement, version);
    }
  }

  // -----------------------------
  // Node Renderer (SAFE async)
  // -----------------------------
  private async renderNode(
    node: StoryblokRichTextJson,
    parent: HTMLElement,
    version: number,
  ): Promise<void> {
    // cancel stale render
    if (version !== this.renderVersion) return;

    if (node.type === 'text') {
      this.renderTextNode(node, parent);
      return;
    }

    // -----------------------------
    // custom component placeholder
    // -----------------------------
    const anchor = this.renderer.createComment('sb-node');
    this.renderer.appendChild(parent, anchor);

    const CustomNode = await this.resolver.resolve(node.type);

    if (version !== this.renderVersion) return;
    if (!anchor.parentNode) return;

    const parentNode = anchor.parentNode as HTMLElement;

    // -----------------------------
    // custom resolved component
    // -----------------------------
    if (CustomNode) {
      const componentRef = createComponent(CustomNode, {
        environmentInjector: this.envInjector,
      });

      componentRef.setInput('node', node);
      this.appRef.attachView(componentRef.hostView);

      const nodes = (componentRef.hostView as any).rootNodes;

      for (const n of nodes) {
        this.renderer.insertBefore(parentNode, n, anchor);
      }

      this.renderer.removeChild(parentNode, anchor);

      this.destroyRef.onDestroy(() => componentRef.destroy());
      return;
    }

    // -----------------------------
    // blok fallback
    // -----------------------------
    if (node.type === 'blok') {
      const blokList = node.attrs?.body;
      if (!blokList?.length) {
        this.renderer.removeChild(parentNode, anchor);
        return;
      }

      const componentRef = createComponent(StoryblokComponent, {
        environmentInjector: this.envInjector,
      });

      componentRef.setInput('bloks', blokList);
      this.appRef.attachView(componentRef.hostView);

      const nodes = (componentRef.hostView as any).rootNodes;
      for (const n of nodes) {
        this.renderer.insertBefore(parentNode, n, anchor);
      }

      this.renderer.removeChild(parentNode, anchor);

      this.destroyRef.onDestroy(() => componentRef.destroy());
      return;
    }

    // -----------------------------
    // normal HTML node
    // -----------------------------
    const tag = resolveTag(node);
    if (!tag) {
      this.renderer.removeChild(parentNode, anchor);
      return;
    }

    const attrs = processAttrs(node.type, node.attrs);
    const el = this.renderer.createElement(tag);

    const staticChildren = getStaticChildren(node);

    if (!staticChildren) {
      this.applyAttributes(el, attrs);
    }

    if (isSelfClosing(tag)) {
      this.renderer.insertBefore(parentNode, el, anchor);
      this.renderer.removeChild(parentNode, anchor);
      return;
    }

    let contentHost = el;

    if (staticChildren) {
      contentHost = this.createStaticScaffold(staticChildren, el, attrs);
    }

    if (node.content) {
      for (const child of node.content) {
        await this.renderNode(child, contentHost, version);
      }
    }

    // Insert before anchor and remove it to maintain correct order
    this.renderer.insertBefore(parentNode, el, anchor);
    this.renderer.removeChild(parentNode, anchor);
  }

  // -----------------------------
  // Text node
  // -----------------------------
  private renderTextNode(
    node: StoryblokRichTextJson & { type: 'text' },
    parent: HTMLElement,
  ): void {
    const textNode = this.renderer.createText(node.text || '');

    if (!node.marks?.length) {
      this.renderer.appendChild(parent, textNode);
      return;
    }

    const last = node.marks.reduce((p, mark) => {
      const tag = resolveTag(mark);
      if (!tag) return p;

      const el = this.renderer.createElement(tag);
      this.applyAttributes(el, processAttrs(mark.type, mark.attrs));

      this.renderer.appendChild(p, el);
      return el;
    }, parent);

    this.renderer.appendChild(last, textNode);
  }

  // -----------------------------
  // Scaffold (tables/code etc)
  // -----------------------------
  private createStaticScaffold(
    specs: readonly RenderSpec[],
    parent: HTMLElement,
    nodeAttrs: Record<string, unknown> = {},
  ): HTMLElement {
    let host = parent;

    for (const spec of specs) {
      const el = this.renderer.createElement(spec.tag);
      this.applyAttributes(el, { ...spec.attrs, ...nodeAttrs });

      this.renderer.appendChild(host, el);

      host = spec.children ? this.createStaticScaffold(spec.children, el) : el;
    }

    return host;
  }

  // -----------------------------
  // Attributes
  // -----------------------------
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

  // -----------------------------
  // Cleanup
  // -----------------------------
  private clearContent(): void {
    let child: ChildNode | null;
    while ((child = this.hostElement.firstChild)) {
      this.renderer.removeChild(this.hostElement, child);
    }
  }
}
