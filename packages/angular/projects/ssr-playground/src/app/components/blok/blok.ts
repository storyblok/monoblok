import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { SbBlokDirective, type AngularRenderNode } from '@storyblok/angular';
import type { SbBlokData } from '@storyblok/angular';
interface BlokProps {
  body?: SbBlokData[];
  id?: string;
  children?: AngularRenderNode[];
}
@Component({
  selector: 'app-blok',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SbBlokDirective],
  template: `
    @for (blok of props().body || []; track blok._uid) {
      <ng-container [sbBlok]="blok" />
    }
  `,
})
export class BlokComponent {
  readonly props = input<BlokProps>({});
}
