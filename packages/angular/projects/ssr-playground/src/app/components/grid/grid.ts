import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { type SbBlokData, SbBlokDirective } from '@storyblok/angular';

export interface GridBlok extends SbBlokData {
  columns?: SbBlokData[];
}

@Component({
  selector: 'app-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SbBlokDirective],
  template: `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      @for (column of blok().columns ?? []; track column._uid) {
        <ng-container [sbBlok]="column" />
      }
    </div>
  `,
})
export class GridComponent {
  readonly blok = input.required<GridBlok>();
}
