import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { type SbBlokData, type StoryblokRichTextJson } from '@storyblok/angular';

export interface TeaserBlok extends SbBlokData {
  headline?: string;
  text?: StoryblokRichTextJson;
}

@Component({
  selector: 'app-teaser',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // imports: [SbRichTextComponent],
  template: `
    <div>
      <h2>{{ blok().headline }}</h2>
      <!-- @if (blok().text) {
        <sb-rich-text [doc]="blok().text!" />
      } -->
    </div>
  `,
})
export class TeaserComponent {
  readonly blok = input.required<TeaserBlok>();
}
