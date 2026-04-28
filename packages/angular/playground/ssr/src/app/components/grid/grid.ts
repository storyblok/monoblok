import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { type SbBlokData, StoryblokComponent } from '@storyblok/angular';

export interface GridBlok {
  columns?: SbBlokData[];
}

@Component({
  selector: 'app-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StoryblokComponent],
  template: `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <sb-component [sbBlok]="blok().columns" />
    </div>
  `,
})
export class GridComponent {
  readonly blok = input.required<GridBlok>();
}
