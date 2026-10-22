import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { type SbBlokData, StoryblokComponent } from '@storyblok/angular';

export interface PageBlok extends SbBlokData {
  body?: SbBlokData[];
}

@Component({
  selector: 'app-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StoryblokComponent],
  template: `<sb-component class="page" [sbBlok]="blok().body"  />`,
})
export class PageComponent {
// Angular signal
  readonly blok = input.required<PageBlok>();

}
