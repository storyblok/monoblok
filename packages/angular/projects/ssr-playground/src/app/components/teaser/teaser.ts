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
    <div
      class="py-16 text-center bg-linear-to-r from-indigo-500 to-purple-600 text-white rounded-lg"
    >
      <h2 class="text-4xl font-bold">{{ blok().headline }}</h2>
      <sb-rich-text [doc]="blok().text" [options]="richTextOptions" class="prose" />
    </div>
  `,
})
export class TeaserComponent {
  readonly blok = input.required<TeaserBlok>();

  /** Custom rich text configuration */
  readonly richTextOptions: StoryblokRichTextOptions<string> = {
    resolvers: {
      link: (node) => {
        // console.log(node);
        return `<p>This is a custom link</p>`;
      },
    },
  };
}
