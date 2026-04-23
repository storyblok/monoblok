import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { type SbBlokData } from '@storyblok/angular';
import { SbRichTextComponent, type StoryblokRichTextJson } from '@storyblok/angular';

export interface ArticleBlok extends SbBlokData {
  title?: string;
  content?: StoryblokRichTextJson;
}

@Component({
  selector: 'app-article',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SbRichTextComponent],
  template: `
    <div class="page">
      <h2>{{ blok().title }}</h2>

      @if (blok().content) {
        <div class="rich-text">
          <sb-rich-text [doc]="blok().content!" />
        </div>
      }
    </div>
  `,
  styles: `
    .rich-text {
      max-width: 65ch;
      line-height: 1.7;
    }
  `,
})
export class ArticleComponent {
  readonly blok = input.required<ArticleBlok>();
}
