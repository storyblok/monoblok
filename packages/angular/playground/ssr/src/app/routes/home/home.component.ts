import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import {
  type SbBlokData,
  SbBlokDirective,
  StoryblokService,
  LivePreviewService,
  Story,
} from '@storyblok/angular';

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SbBlokDirective],
  template: `
    <div class="p-8 max-w-7xl mx-auto">
      <!-- Pass content directly - directive handles null internally -->
      <ng-container [sbBlok]="storyContent()" />
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
  private client = this.storyblok.getClient();
  readonly story = signal<Story | null>(null);
  readonly loading = signal(true);
  readonly storyContent = computed(() => this.story()?.content as SbBlokData | undefined);

  async ngOnInit(): Promise<void> {
    try {
      const { data } = await this.client.stories.get('angular/home', {
        query: {
          version: 'draft',
          resolve_relations: 'featured-articles.articles',
        },
      });
      this.story.set((data?.story as Story) || null);
    } catch (error) {
      throw error;
    } finally {
      this.loading.set(false);
    }
    // Enable live preview for Visual Editor
    this.livePreview.listen((updatedStory) => {
      this.story.set((updatedStory as Story) || null);
    });
  }
}
