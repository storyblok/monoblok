import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { type SbBlokData } from "@storyblok/angular";

type FeaturedArticlesBlok = { title?: string; articles: SbBlokData[] };

@Component({
  selector: "app-feature-posts",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section>
      <h3>{{ blok().title }}</h3>
      @for (article of blok().articles; track article["id"]) {
        <h4>{{ article["name"] }}</h4>
      }
    </section>
  `,
})
export class FeaturedArticlesComponent {
  readonly blok = input.required<FeaturedArticlesBlok>();
}
