import { Directive, input, ViewContainerRef, effect, ComponentRef } from '@angular/core';
import { StoryblokComponentResolver } from './sb-blok.feature';
import { storyblokEditable } from '@storyblok/live-preview';
import { DestroyRef, inject } from '@angular/core';
import { SbBlokData } from './types';

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
  private destroyRef = inject(DestroyRef);

  private renderVersion = 0;
  private currentComponentType: string | null = null;

  constructor() {
    effect(
      () => {
        this.render(this.sbBlok());
      },
      { allowSignalWrites: true },
    );
    // Clean up dynamically created component when directive is destroyed
    this.destroyRef.onDestroy(() => {
      if (this.componentRef) {
        this.componentRef.destroy();
        this.componentRef = null;
      }
    });
  }

  private applyEditableAttributes(componentRef: ComponentRef<unknown>, blok: SbBlokData): void {
    const editable = storyblokEditable(blok);
    const host = componentRef.location.nativeElement;
    if (editable['data-blok-c'] && host && typeof host.setAttribute === 'function') {
      host.setAttribute('data-blok-c', editable['data-blok-c']);
      host.setAttribute('data-blok-uid', editable['data-blok-uid']);
    }
  }

  private async render(blok: SbBlokData | null | undefined) {
    const myVersion = ++this.renderVersion;
    if (!blok?.component) {
      this.currentComponentType = null;
      if (this.componentRef) {
        this.componentRef.destroy();
        this.componentRef = null;
      }
      this.viewContainerRef.clear();
      return;
    }

    const componentType = blok.component;
    const Component = await this.resolver.resolve(componentType);

    // Only continue if this is still the latest render
    if (myVersion !== this.renderVersion) return;
    // Stop if directive already destroyed
    if (this.destroyRef.destroyed) return;
    if (!Component) {
      this.currentComponentType = null;
      if (this.componentRef) {
        this.componentRef.destroy();
        this.componentRef = null;
      }
      this.viewContainerRef.clear();
      return;
    }

    // Destroy and recreate component if type changed
    if (this.componentRef && this.currentComponentType !== componentType) {
      this.viewContainerRef.clear();
      this.componentRef = null;
    }
    if (!this.componentRef) {
      this.componentRef = this.viewContainerRef.createComponent(Component);
    }
    this.currentComponentType = componentType;
    this.componentRef.setInput('blok', blok);
    this.componentRef.changeDetectorRef.markForCheck();
    this.applyEditableAttributes(this.componentRef, blok);
  }
}
