import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { type SbBlokData } from '@storyblok/angular';

export interface FeatureBlok extends SbBlokData {
  name?: string;
}

@Component({
  selector: 'app-feature',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 bg-white border border-slate-200 rounded-lg shadow-sm">
      <h3 class="text-xl font-semibold text-slate-800">{{ blok().name }}</h3>
    </div>
  `,
})
export class FeatureComponent {
  readonly blok = input.required<FeatureBlok>();
}
