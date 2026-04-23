import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { type SbBlokData, type StoryblokRichTextJson } from '@storyblok/angular';
import { RichTextComponentProps } from '@storyblok/richtext/static';

export interface LinkBlok extends RichTextComponentProps<'link'>, SbBlokData {}

@Component({
  selector: 'app-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // imports: [SbRichTextComponent],
  template: `
    <div>
      <h2>This is custom link</h2>
      <!-- @if (blok().text) {
        <sb-rich-text [doc]="blok().text!" />
      } -->
    </div>
  `,
})
export class LinkComponent {
  readonly blok = input.required<LinkBlok>();
}
