import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { type SbBlokData } from '@storyblok/angular';

export interface FeatureBlok extends SbBlokData {
  name?: string;
  description?: string;
}

@Component({
  selector: 'app-feature',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="feature">
      <h3>{{ blok().name }}</h3>
      <p>{{ blok().description }}</p>
    </div>
  `,
})
export class FeatureComponent {
  readonly blok = input.required<FeatureBlok>();
}