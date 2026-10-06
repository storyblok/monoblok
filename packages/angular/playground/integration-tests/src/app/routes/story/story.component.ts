import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { type SbBlokData, StoryblokComponent, type Story } from "@storyblok/angular";

@Component({
  selector: "app-story",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StoryblokComponent],
  template: `
    <main class="p-8 max-w-7xl mx-auto">
      <sb-component [sbBlok]="storyContent()" />
      @if (!storyContent()) {
        <p>No content found</p>
      }
    </main>
  `,
})
export class StoryComponent {
  readonly storyInput = input<Story | null>(null, { alias: "story" });
  readonly storyContent = computed(() => this.storyInput()?.content as SbBlokData | undefined);
}
