import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { type SbBlokData } from '@storyblok/angular';

export interface TeaserBlok extends SbBlokData {
  headline?: string;
}

@Component({
  selector: 'app-teaser',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="teaser">
      <h1>{{ blok().headline }}</h1>
    </div>
  `,
})
export class TeaserComponent {
  readonly blok = input.required<TeaserBlok>();
}