import { Component, ChangeDetectionStrategy, input } from "@angular/core";
import { SbRichTextComponent, type Story, type StoryblokRichTextDoc } from "@storyblok/angular";

export interface ArticleBlok {
  title?: string;
  author?: Story[];
  content?: StoryblokRichTextDoc;
}

@Component({
  selector: "app-article",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SbRichTextComponent],
  template: `
    <div class="page">
      <h2>{{ blok().title }}</h2>
      @for (author of blok().author ?? []; track author.uuid) {
        <p>Author: {{ author.name }}</p>
      }

      @if (blok().content) {
        <div class="rich-text">
          <sb-rich-text [sbDocument]="blok().content!" />
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
