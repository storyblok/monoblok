import {
  Directive,
  input,
  inject,
  ViewContainerRef,
  effect,
  Type,
  ComponentRef,
  DestroyRef,
} from '@angular/core';
import { storyblokEditable, type SbBlokData } from '@storyblok/js';
import { STORYBLOK_COMPONENTS, isComponentLoader } from './storyblok-components';

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
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly components = inject(STORYBLOK_COMPONENTS, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  /** The Storyblok blok data to render */
  readonly sbBlok = input.required<SbBlokData | null | undefined>();

  /** Cache for loaded components to avoid re-importing */
  private readonly componentCache = new Map<string, Type<unknown>>();

  /** Track the currently rendered component */
  private currentComponentRef: ComponentRef<unknown> | null = null;
  private currentComponentName: string | null = null;

  /** Track pending async load to handle race conditions */
  private pendingLoadId = 0;

  /** Flag to guard async work after destroy */
  private destroyed = false;

  constructor() {
    // Mark destroyed and invalidate async loaders
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.pendingLoadId++;
    });

    effect(() => {
      this.handleBlokChange(this.sbBlok());
    });
  }

  private handleBlokChange(blok: SbBlokData | null | undefined): void {
    if (!blok?.component || !this.components) {
      this.cleanup();
      return;
    }

    const entry = this.components[blok.component];
    if (!entry) {
      if (typeof ngDevMode === 'undefined' || ngDevMode) {
        console.warn(`[angular-storyblok] Component "${blok.component}" not found in registry.`);
      }
      this.cleanup();
      return;
    }

    // Same component, just update input
    if (this.currentComponentRef && this.currentComponentName === blok.component) {
      this.updateComponent(this.currentComponentRef, blok);
      return;
    }

    // Component type changed
    this.cleanup();

    if (isComponentLoader(entry)) {
      this.loadAndRenderComponent(blok.component, entry);
    } else {
      this.createAndRenderComponent(entry, blok);
    }
  }

  private async loadAndRenderComponent(
    componentName: string,
    loader: () => Promise<Type<unknown>>,
  ): Promise<void> {
    const loadId = ++this.pendingLoadId;

    let Component = this.componentCache.get(componentName);
    if (!Component) {
      try {
        Component = await loader();
        this.componentCache.set(componentName, Component);
      } catch (error) {
        console.error(`[angular-storyblok] Failed to load component: ${componentName}`, error);
        return;
      }
    }

    // Stop if destroyed or superseded
    if (this.destroyed || loadId !== this.pendingLoadId) {
      return;
    }

    const blok = this.sbBlok();
    if (blok?.component === componentName) {
      this.createAndRenderComponent(Component, blok);
    }
  }

  private createAndRenderComponent(Component: Type<unknown>, blok: SbBlokData): void {
    const componentRef = this.viewContainerRef.createComponent(Component);

    this.currentComponentRef = componentRef;
    this.currentComponentName = blok.component ?? null;

    this.updateComponent(componentRef, blok);
  }

  private updateComponent(componentRef: ComponentRef<unknown>, blok: SbBlokData): void {
    componentRef.setInput('blok', blok);

    // Prevent flicker on updates
    componentRef.changeDetectorRef.detectChanges();

    // Storyblok Visual Editor attributes
    const editable = storyblokEditable(blok);
    const host = componentRef.location.nativeElement as HTMLElement;

    if (editable['data-blok-c']) {
      host.setAttribute('data-blok-c', editable['data-blok-c']);
      host.setAttribute('data-blok-uid', editable['data-blok-uid']);
    }
  }

  private cleanup(): void {
    this.viewContainerRef.clear();
    this.currentComponentRef = null;
    this.currentComponentName = null;
  }
}
