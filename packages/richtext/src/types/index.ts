/**
 * Represents the configuration options for optimizing images in rich text content.
 */
export interface SbRichTextImageOptions {
  /**
   * CSS class to be applied to the image.
   */
  class: string;

  /**
   * Width of the image in pixels.
   */
  width: number;

  /**
   * Height of the image in pixels.
   */
  height: number;

  /**
   * Loading strategy for the image. 'lazy' loads the image when it enters the viewport. 'eager' loads the image immediately.
   */
  loading: 'lazy' | 'eager';

  /**
   * Optional filters that can be applied to the image to adjust its appearance.
   *
   * @example
   *
   * ```typescript
   * const filters: Partial<SbRichTextImageOptions['filters']> = {
   *   blur: 5,
   *   brightness: 150,
   *   grayscale: true
   * }
   * ```
   */
  filters: Partial<{
    blur: number;
    brightness: number;
    fill: 'transparent';
    format: 'webp' | 'png' | 'jpg';
    grayscale: boolean;
    quality: number;
    rotate: 0 | 90 | 180 | 270;
  }>;

  /**
   * Defines a set of source set values that tell the browser different image sizes to load based on screen conditions.
   * The entries can be just the width in pixels or a tuple of width and pixel density.
   *
   * @example
   *
   * ```typescript
   * const srcset: (number | [number, number])[] = [
   *   320,
   *   [640, 2]
   * ]
   * ```
   */
  srcset: (number | [number, number])[];

  /**
   * A list of sizes that correspond to different viewport widths, instructing the browser on which srcset source to use.
   *
   * @example
   *
   * ```typescript
   * const sizes: string[] = [
   *   '(max-width: 320px) 280px',
   *   '(max-width: 480px) 440px',
   *   '800px'
   * ]
   * ```
   */
  sizes: string[];
}
