import { Component, ChangeDetectionStrategy, input } from '@angular/core';

export interface TeaserBlok {
  headline?: string;
}

@Component({
  selector: 'app-teaser',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <h2>{{ blok().headline }}</h2> `,
})
export class TeaserComponent {
  readonly blok = input.required<TeaserBlok>();
}
