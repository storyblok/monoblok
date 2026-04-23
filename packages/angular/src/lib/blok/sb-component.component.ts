import { Component, input } from '@angular/core';
import { SbBlokDirective } from './sb-blok.directive';
import { SbBlokData } from '../types';

@Component({
  selector: 'sb-component',
  standalone: true,
  template: `
    @for (blok of bloks(); track blok._uid) {
      <ng-container [sbBlok]="blok" />
    }
  `,
  imports: [SbBlokDirective],
})
export class StoryblokComponent {
  readonly bloks = input.required<SbBlokData[]>();
}
