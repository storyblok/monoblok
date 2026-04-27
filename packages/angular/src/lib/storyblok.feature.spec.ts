import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { provideStoryblok } from './storyblok.feature';
import { StoryblokService, STORYBLOK_CONFIG } from './storyblok.service';
import { STORYBLOK_COMPONENTS, withStoryblokComponents } from './components.feature';
import { StoryblokComponentResolver } from './blok/sb-blok.feature';

@Component({ selector: 'test-teaser', template: '', standalone: true })
class TeaserComponent {}

@Component({ selector: 'test-grid', template: '', standalone: true })
class GridComponent {}

describe('provideStoryblok', () => {
  it('should provide STORYBLOK_CONFIG token', () => {
    TestBed.configureTestingModule({
      providers: [provideStoryblok({ accessToken: 'test-token' })],
    });

    const config = TestBed.inject(STORYBLOK_CONFIG);

    expect(config).toEqual({ accessToken: 'test-token' });
  });

  it('should initialize StoryblokService via app initializer', () => {
    TestBed.configureTestingModule({
      providers: [provideStoryblok({ accessToken: 'test-token' })],
    });

    const service = TestBed.inject(StoryblokService);

    expect(() => service.getClient()).not.toThrow();
  });

  it('should pass config options to StoryblokService', () => {
    TestBed.configureTestingModule({
      providers: [
        provideStoryblok({
          accessToken: 'test-token',
          region: 'us',
        }),
      ],
    });

    const config = TestBed.inject(STORYBLOK_CONFIG);

    expect(config.accessToken).toBe('test-token');
    expect(config.region).toBe('us');
  });

  it('should collect providers from component features', () => {
    TestBed.configureTestingModule({
      providers: [
        provideStoryblok(
          { accessToken: 'test-token' },
          withStoryblokComponents({
            teaser: TeaserComponent,
            grid: GridComponent,
          }),
        ),
      ],
    });

    const components = TestBed.inject(STORYBLOK_COMPONENTS);

    expect(components['teaser']).toBe(TeaserComponent);
    expect(components['grid']).toBe(GridComponent);
  });

  it('should support lazy-loaded components', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideStoryblok(
          { accessToken: 'test-token' },
          withStoryblokComponents({
            teaser: () => Promise.resolve(TeaserComponent),
          }),
        ),
      ],
    });

    const resolver = TestBed.inject(StoryblokComponentResolver);
    const component = await resolver.resolve('teaser');

    expect(component).toBe(TeaserComponent);
  });

  it('should support multiple features', () => {
    TestBed.configureTestingModule({
      providers: [
        provideStoryblok(
          { accessToken: 'test-token' },
          withStoryblokComponents({ teaser: TeaserComponent }),
          withStoryblokComponents({ grid: GridComponent }),
        ),
      ],
    });

    // Last provider wins for same token
    const components = TestBed.inject(STORYBLOK_COMPONENTS);

    expect(components['grid']).toBe(GridComponent);
  });

  it('should work without any features', () => {
    TestBed.configureTestingModule({
      providers: [provideStoryblok({ accessToken: 'test-token' })],
    });

    const service = TestBed.inject(StoryblokService);

    expect(() => service.getClient()).not.toThrow();
  });
});
