import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import {
  SbRichTextComponent,
  type SbBlokData,
  type StoryblokRichTextNode,
} from '@storyblok/angular';
import type { StoryblokRichTextOptions } from '@storyblok/richtext';

export interface TeaserBlok extends SbBlokData {
  headline?: string;
  text?: StoryblokRichTextNode;
}

@Component({
  selector: 'app-teaser',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SbRichTextComponent],
  template: `
    <div>
      <h2>{{ blok().headline }}</h2>
      <sb-rich-text [doc]="blok().text" [options]="richTextOptions" />
    </div>
  `,
})
export class TeaserComponent {
  readonly blok = input.required<TeaserBlok>();

  /** Custom rich text configuration */
  readonly richTextOptions: StoryblokRichTextOptions<string> = {
    tiptapExtensions: {
      link: (node: any) => {
        console.log(node);
        return `<p>This is a custom link</p>`;
      },
    },
  };
}
