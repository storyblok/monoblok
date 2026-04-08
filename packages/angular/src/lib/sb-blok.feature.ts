import { Injectable, inject } from '@angular/core';
import { STORYBLOK_COMPONENTS, BaseComponentResolver } from './components.feature';

/** Resolver for Storyblok blok components. */
@Injectable({ providedIn: 'root' })
export class StoryblokComponentResolver extends BaseComponentResolver {
  protected readonly registry = inject(STORYBLOK_COMPONENTS, { optional: true });
}
