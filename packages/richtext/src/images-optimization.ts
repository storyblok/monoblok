import type { StoryblokRichTextImageOptimizationOptions } from './types';

export function optimizeImage(src: string, options?: boolean | Partial<StoryblokRichTextImageOptimizationOptions>): { src: string; attrs: Record<string, any> } {
  if (!options) {
    return { src, attrs: {} };
  }
  let w = 0;
  let h = 0;
  const attrs: Record<string, unknown> = {};
  const filterParams: string[] = [];

  function validateAndPushFilterParam(value: number, min: number, max: number, filter: string, filterParams: string[]) {
    if (typeof value !== 'number' || value <= min || value >= max) {
      console.warn(`[StoryblokRichText] - ${filter.charAt(0).toUpperCase() + filter.slice(1)} value must be a number between ${min} and ${max} (inclusive)`);
    }
    else {
      filterParams.push(`${filter}(${value})`);
    }
  }

  if (typeof options === 'object') {
    if (typeof options.width === 'number' && options.width > 0) {
      attrs.width = options.width;
      w = options.width;
    }
    else {
      console.warn('[StoryblokRichText] - Width value must be a number greater than 0');
    }
    if (options.height && typeof options.height === 'number' && options.height > 0) {
      attrs.height = options.height;
      h = options.height;
    }
    else {
      console.warn('[StoryblokRichText] - Height value must be a number greater than 0');
    }
    if (options.loading && ['lazy', 'eager'].includes(options.loading)) {
      attrs.loading = options.loading;
    }
    if (options.class) {
      attrs.class = options.class;
    }

    if (options.filters) {
      const { filters } = options || {};
      const { blur, brightness, fill, format, grayscale, quality, rotate } = filters || {};

      if (blur) {
        validateAndPushFilterParam(blur, 0, 100, 'blur', filterParams);
      }
      if (quality) {
        validateAndPushFilterParam(quality, 0, 100, 'quality', filterParams);
      }
      if (brightness) {
        validateAndPushFilterParam(brightness, 0, 100, 'brightness', filterParams);
      }
      if (fill) {
        filterParams.push(`fill(${fill})`);
      }
      if (grayscale) {
        filterParams.push(`grayscale()`);
      }
      if (rotate && [0, 90, 180, 270].includes(options.filters.rotate || 0)) {
        filterParams.push(`rotate(${rotate})`);
      }
      if (format && ['webp', 'png', 'jpeg'].includes(format)) {
        filterParams.push(`format(${format})`);
      }
    }

    // Construct srcset attribute
    if (options.srcset) {
      attrs.srcset = options.srcset.map((entry): string | undefined => {
        if (typeof entry === 'number') {
          return `${src}/m/${entry}x0/${filterParams.length > 0 ? `filters:${filterParams.join(':')}` : ''} ${entry}w`;
        }
        if (Array.isArray(entry) && entry.length === 2) {
          const [entryWidth, entryHeight] = entry;
          return `${src}/m/${entryWidth}x${entryHeight}/${filterParams.length > 0 ? `filters:${filterParams.join(':')}` : ''} ${entryWidth}w`;
        }
        else {
          console.warn('[StoryblokRichText] - srcset entry must be a number or a tuple of two numbers');
          return undefined;
        }
      }).join(', ');
    }

    // Construct sizes attribute
    if (options.sizes) {
      attrs.sizes = options.sizes.join(', ');
    }
  }

  // server-side WebP support detection https://www.storyblok.com/docs/image-service/#optimize
  // https://a.storyblok.com/f/39898/3310x2192/e4ec08624e/demo-image.jpeg/m/
  let resultSrc = `${src}/m/`;
  if (w > 0 && h > 0) {
    resultSrc = `${resultSrc}${w}x${h}/`;
  }
  if (filterParams.length > 0) {
    resultSrc = `${resultSrc}filters:${filterParams.join(':')}`;
  }

  return {
    src: resultSrc,
    attrs,
  };
}
