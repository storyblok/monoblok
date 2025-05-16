import { describe, expect, it, vi } from 'vitest';

import { optimizeImage } from './images-optimization';

describe('images-optimization', () => {
  it('should return the original src if no options are passed', async () => {
    const src = 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg';
    const { src: resultSrc } = optimizeImage(src);
    expect(resultSrc).toBe(src);
  });

  it('should return an empty attr object if no options are passed', async () => {
    const src = 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg';
    const { attrs } = optimizeImage(src);
    expect(attrs).toEqual({});
  });

  it('should provide server-side WebP support detection if option is true', async () => {
    const src = 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg';
    const { src: resultSrc } = optimizeImage(src, true);
    expect(resultSrc).toBe(`${src}/m/`);
  });

  it('should add width and height to the src if provided', async () => {
    const src = 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg';
    const { src: resultSrc } = optimizeImage(src, { width: 800, height: 600 });
    expect(resultSrc).toBe(`${src}/m/800x600/`);
  });

  it('should not add width to the src if width is not a number', async () => {
    const src = 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg';
    const consoleWarnSpy = vi.spyOn(console, 'warn');
    optimizeImage(src, { width: '800', height: 600 });
    expect(consoleWarnSpy).toBeCalledWith('[StoryblokRichText] - Width value must be a number greater than 0');
    consoleWarnSpy.mockRestore();
  });

  it('should not add width to the src if width is less than 0', async () => {
    const src = 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg';
    const consoleWarnSpy = vi.spyOn(console, 'warn');
    optimizeImage(src, { width: -800, height: 600 });
    expect(consoleWarnSpy).toBeCalledWith('[StoryblokRichText] - Width value must be a number greater than 0');
    consoleWarnSpy.mockRestore();
  });

  it('should add width to the attrs if provided', async () => {
    const src = 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg';
    const { attrs } = optimizeImage(src, { width: 800, height: 600 });
    expect(attrs).toEqual({ width: 800, height: 600 });
  });

  it('should not add height to the src if height is not a number', async () => {
    const src = 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg';
    const consoleWarnSpy = vi.spyOn(console, 'warn');
    optimizeImage(src, { width: 800, height: '600' });
    expect(consoleWarnSpy).toBeCalledWith('[StoryblokRichText] - Height value must be a number greater than 0');
    consoleWarnSpy.mockRestore();
  });

  it('should not add height to the src if height is less than 0', async () => {
    const src = 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg';
    const consoleWarnSpy = vi.spyOn(console, 'warn');
    optimizeImage(src, { width: 800, height: -600 });
    expect(consoleWarnSpy).toBeCalledWith('[StoryblokRichText] - Height value must be a number greater than 0');
    consoleWarnSpy.mockRestore();
  });

  it('should add loading attribute if provided', async () => {
    const src = 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg';
    const { attrs } = optimizeImage(src, { loading: 'lazy' });
    expect(attrs).toEqual({ loading: 'lazy' });
  });

  it('should add class attribute if provided', async () => {
    const src = 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg';
    const { attrs } = optimizeImage(src, { class: 'doge' });
    expect(attrs).toEqual({ class: 'doge' });
  });

  it('should add blur filter if provided', async () => {
    const src = 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg';
    const { src: resultSrc } = optimizeImage(src, { filters: { blur: 5 } });
    expect(resultSrc).toBe(`${src}/m/filters:blur(5)`);
  });

  it('should not add blur filter if value is not a number', async () => {
    const src = 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg';
    const consoleWarnSpy = vi.spyOn(console, 'warn');
    optimizeImage(src, { filters: { blur: '5' } });
    expect(consoleWarnSpy).toBeCalledWith('[StoryblokRichText] - Blur value must be a number between 0 and 100 (inclusive)');
    consoleWarnSpy.mockRestore();
  });

  it('should not add blur filter if value is less than 0', async () => {
    const src = 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg';
    const consoleWarnSpy = vi.spyOn(console, 'warn');
    optimizeImage(src, { filters: { blur: -5 } });
    expect(consoleWarnSpy).toBeCalledWith('[StoryblokRichText] - Blur value must be a number between 0 and 100 (inclusive)');
    consoleWarnSpy.mockRestore();
  });

  it('should not add blur filter if value is greater than 100', async () => {
    const src = 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg';
    const consoleWarnSpy = vi.spyOn(console, 'warn');
    optimizeImage(src, { filters: { blur: 105 } });
    expect(consoleWarnSpy).toBeCalledWith('[StoryblokRichText] - Blur value must be a number between 0 and 100 (inclusive)');
    consoleWarnSpy.mockRestore();
  });

  it('should add brightness filter if provided', async () => {
    const src = 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg';
    const { src: resultSrc } = optimizeImage(src, { filters: { brightness: 0.5 } });
    expect(resultSrc).toBe(`${src}/m/filters:brightness(0.5)`);
  });

  it('should not add brightness filter if value is not a number', async () => {
    const src = 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg';
    const consoleWarnSpy = vi.spyOn(console, 'warn');
    optimizeImage(src, { filters: { brightness: '0.5' } });
    expect(consoleWarnSpy).toBeCalledWith('[StoryblokRichText] - Brightness value must be a number between 0 and 100 (inclusive)');
    consoleWarnSpy.mockRestore();
  });

  it('should not add brightness filter if value is less than 0', async () => {
    const src = 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg';
    const consoleWarnSpy = vi.spyOn(console, 'warn');
    optimizeImage(src, { filters: { brightness: -0.5 } });
    expect(consoleWarnSpy).toBeCalledWith('[StoryblokRichText] - Brightness value must be a number between 0 and 100 (inclusive)');
    consoleWarnSpy.mockRestore();
  });

  it('should not add brightness filter if value is greater than 100', async () => {
    const src = 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg';
    const consoleWarnSpy = vi.spyOn(console, 'warn');
    optimizeImage(src, { filters: { brightness: 105 } });
    expect(consoleWarnSpy).toBeCalledWith('[StoryblokRichText] - Brightness value must be a number between 0 and 100 (inclusive)');
    consoleWarnSpy.mockRestore();
  });

  it('should add fill filter if provided', async () => {
    const src = 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg';
    const { src: resultSrc } = optimizeImage(src, { filters: { fill: 'transparent' } });
    expect(resultSrc).toBe(`${src}/m/filters:fill(transparent)`);
  });

  it('should add grayscale filter if provided', async () => {
    const src = 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg';
    const { src: resultSrc } = optimizeImage(src, { filters: { grayscale: true } });
    expect(resultSrc).toBe(`${src}/m/filters:grayscale()`);
  });

  it('should add quality filter if provided', async () => {
    const src = 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg';
    const { src: resultSrc } = optimizeImage(src, { filters: { quality: 80 } });
    expect(resultSrc).toBe(`${src}/m/filters:quality(80)`);
  });

  it('should not add quality filter if value is not a number', async () => {
    const src = 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg';
    const consoleWarnSpy = vi.spyOn(console, 'warn');
    optimizeImage(src, { filters: { quality: '80' } });
    expect(consoleWarnSpy).toBeCalledWith('[StoryblokRichText] - Quality value must be a number between 0 and 100 (inclusive)');
    consoleWarnSpy.mockRestore();
  });

  it('should not add quality filter if value is less than 0', async () => {
    const src = 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg';
    const consoleWarnSpy = vi.spyOn(console, 'warn');
    optimizeImage(src, { filters: { quality: -80 } });
    expect(consoleWarnSpy).toBeCalledWith('[StoryblokRichText] - Quality value must be a number between 0 and 100 (inclusive)');
    consoleWarnSpy.mockRestore();
  });

  it('should not add quality filter if value is greater than 100', async () => {
    const src = 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg';
    const consoleWarnSpy = vi.spyOn(console, 'warn');
    optimizeImage(src, { filters: { quality: 105 } });
    expect(consoleWarnSpy).toBeCalledWith('[StoryblokRichText] - Quality value must be a number between 0 and 100 (inclusive)');
    consoleWarnSpy.mockRestore();
  });

  it('should add rotate filter if provided', async () => {
    const src = 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg';
    const { src: resultSrc } = optimizeImage(src, { filters: { rotate: 90 } });
    expect(resultSrc).toBe(`${src}/m/filters:rotate(90)`);
  });

  it('should add format filter if provided', async () => {
    const src = 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg';
    const { src: resultSrc } = optimizeImage(src, { filters: { format: 'webp' } });
    expect(resultSrc).toBe(`${src}/m/filters:format(webp)`);
  });

  it('should add multiple filters if provided', async () => {
    const src = 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg';
    const filters = {
      blur: 5,
      brightness: 0.5,
      fill: 'transparent',
      grayscale: true,
      quality: 80,
      rotate: 90,
      format: 'webp',
    };
    const { src: resultSrc } = optimizeImage(src, { filters });
    expect(resultSrc).toBe(`${src}/m/filters:blur(5):quality(80):brightness(0.5):fill(transparent):grayscale():rotate(90):format(webp)`);
  });

  it('should not add filters if options filter is empty', async () => {
    const src = 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg';
    const { src: resultSrc } = optimizeImage(src, { filters: {} });
    expect(resultSrc).toBe(`${src}/m/`);
  });

  it('should add srcset attribute if provided', async () => {
    const src = 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg';
    const srcset = [400, 800, 1200];
    const { attrs } = optimizeImage(src, { srcset });
    expect(attrs).toEqual({ srcset: 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg/m/400x0/ 400w, https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg/m/800x0/ 800w, https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg/m/1200x0/ 1200w' });
  });

  it('should add srcset attribute with width and height if provided as an array of arrays', async () => {
    const src = 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg';
    const srcset = [[400, 300], [800, 600], [1200, 900]];
    const { attrs } = optimizeImage(src, { srcset });
    expect(attrs).toEqual({ srcset: 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg/m/400x300/ 400w, https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg/m/800x600/ 800w, https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg/m/1200x900/ 1200w' });
  });

  it('should add sizes attribute if provided', async () => {
    const src = 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg';
    const sizes = ['(min-width: 600px) 50vw', '100vw'];
    const { attrs } = optimizeImage(src, { sizes });
    expect(attrs).toEqual({ sizes: '(min-width: 600px) 50vw, 100vw' });
  });

  it('should add srcset and sizes attributes if provided', async () => {
    const src = 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg';
    const srcset = [400, 800, 1200];
    const sizes = ['(min-width: 600px) 50vw', '100vw'];
    const { attrs } = optimizeImage(src, { srcset, sizes });
    expect(attrs).toEqual({ srcset: 'https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg/m/400x0/ 400w, https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg/m/800x0/ 800w, https://a.storyblok.com/f/279818/710x528/c53330ed26/tresjs-doge.jpg/m/1200x0/ 1200w', sizes: '(min-width: 600px) 50vw, 100vw' });
  });
});
