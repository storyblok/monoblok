import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { StoryblokComponentResolver } from './sb-blok.feature';
import { STORYBLOK_COMPONENTS } from './components.feature';

@Component({ selector: 'test-teaser', template: '', standalone: true })
class TeaserComponent {}

@Component({ selector: 'test-grid', template: '', standalone: true })
class GridComponent {}

describe('StoryblokComponentResolver', () => {
  describe('with registered components', () => {
    let resolver: StoryblokComponentResolver;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          StoryblokComponentResolver,
          {
            provide: STORYBLOK_COMPONENTS,
            useValue: {
              teaser: TeaserComponent,
              grid: () => Promise.resolve(GridComponent),
            },
          },
        ],
      });
      resolver = TestBed.inject(StoryblokComponentResolver);
    });

    it('should be created', () => {
      expect(resolver).toBeTruthy();
    });

    it('should resolve eager component', async () => {
      const result = await resolver.resolve('teaser');

      expect(result).toBe(TeaserComponent);
    });

    it('should resolve lazy component', async () => {
      const result = await resolver.resolve('grid');

      expect(result).toBe(GridComponent);
    });

    it('should return null for unregistered component', async () => {
      const result = await resolver.resolve('unknown');

      expect(result).toBeNull();
    });

    it('should check if component exists with has()', () => {
      expect(resolver.has('teaser')).toBe(true);
      expect(resolver.has('grid')).toBe(true);
      expect(resolver.has('unknown')).toBe(false);
    });

    it('should get eager component synchronously with getSync()', () => {
      expect(resolver.getSync('teaser')).toBe(TeaserComponent);
    });

    it('should return null for lazy component with getSync() before resolve', () => {
      expect(resolver.getSync('grid')).toBeNull();
    });

    it('should return lazy component with getSync() after resolve', async () => {
      await resolver.resolve('grid');

      expect(resolver.getSync('grid')).toBe(GridComponent);
    });

    it('should return registered keys', () => {
      const keys = resolver.getRegisteredKeys();

      expect(keys).toContain('teaser');
      expect(keys).toContain('grid');
    });

    it('should cache resolved components', async () => {
      const first = await resolver.resolve('teaser');
      const second = await resolver.resolve('teaser');

      expect(first).toBe(second);
    });
  });

  describe('without registered components', () => {
    let resolver: StoryblokComponentResolver;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [StoryblokComponentResolver],
      });
      resolver = TestBed.inject(StoryblokComponentResolver);
    });

    it('should be created without STORYBLOK_COMPONENTS provided', () => {
      expect(resolver).toBeTruthy();
    });

    it('should return null when resolving without registry', async () => {
      const result = await resolver.resolve('teaser');

      expect(result).toBeNull();
    });

    it('should return false for has() without registry', () => {
      expect(resolver.has('teaser')).toBe(false);
    });

    it('should return null for getSync() without registry', () => {
      expect(resolver.getSync('teaser')).toBeNull();
    });

    it('should return empty array for getRegisteredKeys() without registry', () => {
      expect(resolver.getRegisteredKeys()).toEqual([]);
    });
  });
});
