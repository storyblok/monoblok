import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from "@angular/core";
import {
  type BridgeParams,
  type SbBlokData,
  LivePreviewService,
  Story,
  StoryblokComponent,
  StoryblokService,
} from "@storyblok/angular";

@Component({
  selector: "app-home",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StoryblokComponent],
  template: `
    <div class="p-8 max-w-7xl mx-auto">
      <sb-component [sbBlok]="storyContent()" />
      @if (loading()) {
        <p class="text-slate-500">Loading...</p>
      } @else if (!storyContent()) {
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h2 class="text-yellow-800 text-xl font-semibold mb-2">No content found</h2>
          <p class="text-yellow-600">No story found for slug: home</p>
        </div>
      }
    </div>
  `,
})
export class HomeComponent implements OnInit {
  private readonly storyblok = inject(StoryblokService);
  private readonly livePreview = inject(LivePreviewService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly client = this.storyblok.getClient();

  readonly story = signal<Story | null>(null);
  readonly loading = signal(true);
  readonly storyContent = computed(() => this.story()?.content as SbBlokData | undefined);

  private readonly bridgeConfig: BridgeParams = {
    resolveRelations: ["featured-articles.articles", "article.author"],
    preventClicks: true,
  };

  ngOnInit(): void {
    this.livePreview.connect(
      (updatedStory) => this.story.set((updatedStory as Story) || null),
      this.destroyRef,
      this.bridgeConfig,
    );

    void this.loadStory();
  }

  private async loadStory(): Promise<void> {
    try {
      const { data } = await this.client.stories.get("angular/home", {
        query: {
          version: "draft",
          resolve_relations: "featured-articles.articles,article.author",
        },
      });
      this.story.set((data?.story as Story) || null);
    } finally {
      this.loading.set(false);
    }
  }
}
