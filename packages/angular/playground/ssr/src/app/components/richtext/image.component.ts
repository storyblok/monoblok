import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { type SbAngularRichTextProps } from '@storyblok/angular';
import { buildStoryblokImage } from '@storyblok/richtext';

/**
 * Custom image component demonstrating Storyblok image optimization.
 * Uses buildStoryblokImage to apply responsive sizing and lazy loading.
 */
@Component({
  selector: 'app-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (optimizedImage().src) {
      <img
        [src]="optimizedImage().src"
        [alt]="data().attrs?.alt ?? ''"
        [attr.width]="optimizedImage().attrs['width']"
        [attr.height]="optimizedImage().attrs['height']"
        [attr.loading]="optimizedImage().attrs['loading']"
      />
    }
  `,
  host: { style: 'display: contents' },
})
export class ImageComponent {
  readonly data = input.required<SbAngularRichTextProps<'image'>>();

  /** Apply Storyblok image optimization */
  readonly optimizedImage = computed(() => {
    const src = this.data().attrs?.src;
    if (!src) {
      return { src: '', attrs: {} };
    }

    return buildStoryblokImage(src, {
      width: 800,
      loading: 'lazy',
    });
  });
}
