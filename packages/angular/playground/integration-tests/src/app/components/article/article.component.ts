import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { SbRichTextComponent, type Story, type StoryblokRichTextDoc } from "@storyblok/angular";

type ArticleBlok = {
  title?: string;
  author?: Story[];
  content?: StoryblokRichTextDoc;
};

@Component({
  selector: "app-article",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SbRichTextComponent],
  template: `
    <article>
      <h2>{{ blok().title }}</h2>
      @for (author of blok().author ?? []; track author.uuid) {
        <p>Author: {{ author.name }}</p>
      }
      @if (blok().content) {
        <div class="rich-text"><sb-rich-text [sbDocument]="blok().content!" /></div>
      }
    </article>
  `,
})
export class ArticleComponent {
  readonly blok = input.required<ArticleBlok>();
}
