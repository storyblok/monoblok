import { Component, Type } from '@angular/core';
import { describe, it, expect } from 'vitest';
import {
  isComponentLoader,
  withStoryblokComponents,
  STORYBLOK_COMPONENTS,
  BaseComponentResolver,
  StoryblokComponentLoader,
  ComponentRegistry,
} from './components.feature';

@Component({ selector: 'test-comp', template: '', standalone: true })
class TestComponent {}

@Component({ selector: 'test-comp-2', template: '', standalone: true })
class TestComponent2 {}

describe('isComponentLoader', () => {
  it('should return true for arrow function loaders', () => {
    const loader: StoryblokComponentLoader = () => Promise.resolve(TestComponent);

    expect(isComponentLoader(loader)).toBe(true);
  });

  it('should return true for async function loaders', () => {
    const loader: StoryblokComponentLoader = async () => TestComponent;

    expect(isComponentLoader(loader)).toBe(true);
  });

  it('should return false for component classes', () => {
    expect(isComponentLoader(TestComponent)).toBe(false);
  });

  it('should return false for classes with prototype', () => {
    class SomeClass {
      method() {}
    }

    expect(isComponentLoader(SomeClass)).toBe(false);
  });
});

describe('withStoryblokComponents', () => {
  it('should return a feature with kind "components"', () => {
    const feature = withStoryblokComponents({
      teaser: TestComponent,
    });

    expect(feature.ɵkind).toBe('components');
  });

  it('should provide STORYBLOK_COMPONENTS token with the components map', () => {
    const components = {
      teaser: TestComponent,
      grid: () => Promise.resolve(TestComponent2),
    };

    const feature = withStoryblokComponents(components);

    expect(feature.ɵproviders).toHaveLength(1);
    expect(feature.ɵproviders[0]).toEqual({
      provide: STORYBLOK_COMPONENTS,
      useValue: components,
    });
  });

  it('should handle empty components map', () => {
    const feature = withStoryblokComponents({});

    expect(feature.ɵkind).toBe('components');
    expect(feature.ɵproviders[0]).toEqual({
      provide: STORYBLOK_COMPONENTS,
      useValue: {},
    });
  });
});

describe('BaseComponentResolver', () => {
  function createResolver(registry: ComponentRegistry | null) {
    class TestResolver extends BaseComponentResolver {
      protected readonly registry = registry;
    }
    return new TestResolver();
  }

  describe('has', () => {
    it('should return true when component is registered', () => {
      const resolver = createResolver({ teaser: TestComponent });

      expect(resolver.has('teaser')).toBe(true);
    });

    it('should return false when component is not registered', () => {
      const resolver = createResolver({ teaser: TestComponent });

      expect(resolver.has('grid')).toBe(false);
    });

    it('should return false when registry is null', () => {
      const resolver = createResolver(null);

      expect(resolver.has('teaser')).toBe(false);
    });

    it('should return true for lazy loader entries', () => {
      const resolver = createResolver({
        teaser: () => Promise.resolve(TestComponent),
      });

      expect(resolver.has('teaser')).toBe(true);
    });
  });

  describe('getSync', () => {
    it('should return eager component directly', () => {
      const resolver = createResolver({ teaser: TestComponent });

      expect(resolver.getSync('teaser')).toBe(TestComponent);
    });

    it('should return null for lazy loader (not yet resolved)', () => {
      const resolver = createResolver({
        teaser: () => Promise.resolve(TestComponent),
      });

      expect(resolver.getSync('teaser')).toBeNull();
    });

    it('should return cached component after async resolve', async () => {
      const resolver = createResolver({
        teaser: () => Promise.resolve(TestComponent),
      });

      await resolver.resolve('teaser');

      expect(resolver.getSync('teaser')).toBe(TestComponent);
    });

    it('should return null for unregistered component', () => {
      const resolver = createResolver({ teaser: TestComponent });

      expect(resolver.getSync('grid')).toBeNull();
    });

    it('should return null when registry is null', () => {
      const resolver = createResolver(null);

      expect(resolver.getSync('teaser')).toBeNull();
    });

    it('should cache eager components after first getSync call', () => {
      const resolver = createResolver({ teaser: TestComponent });

      resolver.getSync('teaser');
      const secondCall = resolver.getSync('teaser');

      expect(secondCall).toBe(TestComponent);
    });
  });

  describe('resolve', () => {
    it('should resolve eager component', async () => {
      const resolver = createResolver({ teaser: TestComponent });

      const result = await resolver.resolve('teaser');

      expect(result).toBe(TestComponent);
    });

    it('should resolve lazy component', async () => {
      const resolver = createResolver({
        teaser: () => Promise.resolve(TestComponent),
      });

      const result = await resolver.resolve('teaser');

      expect(result).toBe(TestComponent);
    });

    it('should return null for unregistered component', async () => {
      const resolver = createResolver({ teaser: TestComponent });

      const result = await resolver.resolve('grid');

      expect(result).toBeNull();
    });

    it('should return null when registry is null', async () => {
      const resolver = createResolver(null);

      const result = await resolver.resolve('teaser');

      expect(result).toBeNull();
    });

    it('should cache resolved lazy components', async () => {
      let loadCount = 0;
      const resolver = createResolver({
        teaser: () => {
          loadCount++;
          return Promise.resolve(TestComponent);
        },
      });

      await resolver.resolve('teaser');
      await resolver.resolve('teaser');

      expect(loadCount).toBe(1);
    });

    it('should return cached component on subsequent calls', async () => {
      const resolver = createResolver({
        teaser: () => Promise.resolve(TestComponent),
      });

      const first = await resolver.resolve('teaser');
      const second = await resolver.resolve('teaser');

      expect(first).toBe(second);
    });
  });

  describe('getRegisteredKeys', () => {
    it('should return all registered keys', () => {
      const resolver = createResolver({
        teaser: TestComponent,
        grid: TestComponent2,
      });

      const keys = resolver.getRegisteredKeys();

      expect(keys).toContain('teaser');
      expect(keys).toContain('grid');
      expect(keys).toHaveLength(2);
    });

    it('should return empty array when registry is null', () => {
      const resolver = createResolver(null);

      expect(resolver.getRegisteredKeys()).toEqual([]);
    });

    it('should return empty array for empty registry', () => {
      const resolver = createResolver({});

      expect(resolver.getRegisteredKeys()).toEqual([]);
    });
  });
});
