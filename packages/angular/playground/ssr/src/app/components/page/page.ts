import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import {
  SbRichTextComponent,
  type SbBlokData,
  SbBlokDirective,
  type StoryblokRichTextJson,
} from '@storyblok/angular';

export interface PageBlok {
  body?: SbBlokData[];
  richText?: StoryblokRichTextJson;
}

@Component({
  selector: 'app-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SbBlokDirective, SbRichTextComponent],
  template: `
    <div class="space-y-8">
      @for (blok of blok().body ?? []; track blok['_uid']) {
        <ng-container [sbBlok]="blok" />
      }
      <div>
        @if (blok().richText) {
          <sb-rich-text [doc]="blok().richText!" />
        }
      </div>
    </div>
  `,
})
export class PageComponent {
  readonly blok = input.required<PageBlok>();
}
