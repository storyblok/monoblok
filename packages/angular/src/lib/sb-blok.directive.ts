import {
  ComponentRef,
  DestroyRef,
  Directive,
  effect,
  inject,
  input,
  untracked,
  ViewContainerRef,
} from '@angular/core';
import { storyblokEditable } from '@storyblok/live-preview';

import { StoryblokComponentResolver } from './sb-blok.feature';
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
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly resolver = inject(StoryblokComponentResolver);
  private readonly destroyRef = inject(DestroyRef);

  readonly sbBlok = input.required<SbBlokData | null | undefined>();

  private componentRef: ComponentRef<unknown> | null = null;
  private currentComponentType: string | null = null;
  private renderVersion = 0;

  constructor() {
    effect(() => {
      const blok = this.sbBlok();
      untracked(() => this.render(blok));
    });

    this.destroyRef.onDestroy(() => this.componentRef?.destroy());
  }

  private clearComponent(): void {
    this.componentRef?.destroy();
    this.componentRef = null;
    this.currentComponentType = null;
    this.viewContainerRef.clear();
  }

  private applyEditableAttributes(componentRef: ComponentRef<unknown>, blok: SbBlokData): void {
    const editable = storyblokEditable(blok);
    const host = componentRef.location.nativeElement;
    if (editable['data-blok-c'] && host?.setAttribute) {
      host.setAttribute('data-blok-c', editable['data-blok-c']);
      host.setAttribute('data-blok-uid', editable['data-blok-uid']);
    }
  }

  private async render(blok: SbBlokData | null | undefined): Promise<void> {
    const myVersion = ++this.renderVersion;

    if (!blok?.component) {
      this.clearComponent();
      return;
    }

    const componentType = blok.component;
    const Component = await this.resolver.resolve(componentType);

    // Bail if a newer render was triggered or directive was destroyed
    if (myVersion !== this.renderVersion || this.destroyRef.destroyed) {
      return;
    }

    if (!Component) {
      this.clearComponent();
      return;
    }

    // Recreate component only if type changed
    if (this.currentComponentType !== componentType) {
      this.clearComponent();
      this.componentRef = this.viewContainerRef.createComponent(Component);
    }

    this.currentComponentType = componentType;
    this.componentRef!.setInput('blok', blok);
    this.applyEditableAttributes(this.componentRef!, blok);
  }
}
