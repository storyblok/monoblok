import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { StoryblokComponent, type SbBlokData } from "@storyblok/angular";

type PageBlok = { body?: SbBlokData[] };

@Component({
  selector: "app-page",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StoryblokComponent],
  template: `
    @if (blok().body?.[0]?.["title"]; as title) {
      <h1>{{ title }}</h1>
    }
    <sb-component [sbBlok]="blok().body ?? []" />
  `,
})
export class PageComponent {
  readonly blok = input.required<PageBlok>();
}
