import { Component, computed, input } from '@angular/core';
import { SbBlokDirective } from './sb-blok.directive';
import { SbBlokData } from '../types';

@Component({
  selector: 'sb-component',
  standalone: true,
  imports: [SbBlokDirective],
  template: `
    @for (blok of bloks(); track blok._uid) {
      <ng-container [sbBlok]="blok" />
    }
  `,
})
export class StoryblokComponent {
  readonly sbBlok = input<SbBlokData | SbBlokData[] | null | undefined>();

  readonly bloks = computed(() => {
    const value = this.sbBlok();

    if (!value) {
      return [];
    }

    return Array.isArray(value) ? value : [value];
  });
}
