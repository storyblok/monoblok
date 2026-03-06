import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { type SbBlokData, SbBlokDirective } from '@storyblok/angular';

export interface PageBlok extends SbBlokData {
  body?: SbBlokData[];
}

@Component({
  selector: 'app-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SbBlokDirective],
  template: `
    <div class="space-y-8">
      @for (blok of blok().body ?? []; track blok._uid) {
        <ng-container [sbBlok]="blok" />
      }
    </div>
  `,
})
export class PageComponent {
  readonly blok = input.required<PageBlok>();
}
