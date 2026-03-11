import { Injectable, inject, Type } from '@angular/core';
import { STORYBLOK_COMPONENTS, isComponentLoader } from './components.feature';

@Injectable({ providedIn: 'root' })
export class StoryblokComponentResolver {
  private registry = inject(STORYBLOK_COMPONENTS, { optional: true });

  private cache = new Map<string, Type<unknown>>();

  async resolve(name: string): Promise<Type<unknown> | null> {
    if (!this.registry) return null;

    const entry = this.registry[name];
    if (!entry) return null;

    if (this.cache.has(name)) {
      return this.cache.get(name)!;
    }

    let component: Type<unknown>;

    if (isComponentLoader(entry)) {
      component = await entry();
    } else {
      component = entry;
    }

    this.cache.set(name, component);

    return component;
  }
}
