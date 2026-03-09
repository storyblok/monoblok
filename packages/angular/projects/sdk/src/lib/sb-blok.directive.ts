import { Directive, input, inject, ViewContainerRef, effect, ComponentRef } from '@angular/core';
import type { SbBlokData } from '@storyblok/js';
import { StoryblokComponentResolver } from './sb-blok.feature';
import { storyblokEditable } from '@storyblok/live-preview';
/**
 * Directive that dynamically renders a Storyblok component based on the blok data.
 * Supports both eager and lazy-loaded components for optimal bundle size.
 *
 * The directive looks up the component from the registry (configured via
 * `withStoryblokComponents()`) using the `blok.component` field as the key.
 *
 * @example
 * ```html
 * <!-- Render a single blok -->
 * <ng-container [sbBlok]="storyContent()" />
 *
 * <!-- Render a list of bloks -->
 * @for (blok of story().content.body; track blok._uid) {
 *   <ng-container [sbBlok]="blok" />
 * }
 * ```
 *
 * @example
 * ```typescript
 * // In your component
 * @Component({
 *   imports: [SbBlokDirective],
 *   template: `<ng-container [sbBlok]="content()" />`
 * })
 * export class MyComponent {
 *   content = input<SbBlokData>();
 * }
 * ```
 */
@Directive({
  selector: '[sbBlok]',
})
export class SbBlokDirective {
  private viewContainerRef = inject(ViewContainerRef);
  private resolver = inject(StoryblokComponentResolver);

  readonly sbBlok = input.required<SbBlokData | null | undefined>();

  private componentRef: ComponentRef<unknown> | null = null;

  constructor() {
    effect(() => {
      this.render(this.sbBlok());
    });
  }
  private applyEditableAttributes(componentRef: ComponentRef<unknown>, blok: SbBlokData): void {
    const editable = storyblokEditable(blok);
    const host = componentRef.location.nativeElement as HTMLElement;

    if (editable['data-blok-c']) {
      host.setAttribute('data-blok-c', editable['data-blok-c']);
      host.setAttribute('data-blok-uid', editable['data-blok-uid']);
    }
  }
  private async render(blok: SbBlokData | null | undefined) {
    if (!blok?.component) {
      this.viewContainerRef.clear();
      return;
    }

    const Component = await this.resolver.resolve(blok.component);

    if (!Component) {
      this.viewContainerRef.clear();
      return;
    }

    if (!this.componentRef) {
      this.componentRef = this.viewContainerRef.createComponent(Component);
    }

    this.componentRef.setInput('blok', blok);
    this.componentRef.changeDetectorRef.detectChanges();
    this.applyEditableAttributes(this.componentRef, blok);
  }
}
