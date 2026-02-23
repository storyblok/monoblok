import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  OnInit,
  linkedSignal,
  input,
} from '@angular/core';
import {
  type ISbStoryData,
  type SbBlokData,
  SbBlokDirective,
  LivePreviewService,
} from '@storyblok/angular';
import { BridgeParams } from '@storyblok/preview-bridge';

@Component({
  selector: 'app-catch-all',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SbBlokDirective],
  template: `
    <div class="p-8 max-w-7xl mx-auto">
      <!-- Pass content directly - directive handles null internally -->
      <ng-container [sbBlok]="storyContent()" />
      @if (!storyContent()) {
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h2 class="text-yellow-800 text-xl font-semibold mb-2">No content found</h2>
        </div>
      }
    </div>
  `,
})
export class CatchAllComponent implements OnInit {
  private readonly livePreview = inject(LivePreviewService);

  /** SSR source of truth */
  readonly storyInput = input<ISbStoryData | null>(null, { alias: 'story' });

  /** Writable signal linked to input - allows bridge updates */
  readonly story = linkedSignal(() => this.storyInput());

  readonly storyContent = computed(() => this.story()?.content as SbBlokData | undefined);

  readonly bridgeConfig: BridgeParams = {
    resolveRelations: ['feature_posts.posts'],
  };
  ngOnInit(): void {
    // Enable live preview for real-time editing in the Visual Editor
    this.livePreview.listen((updatedStory) => {
      this.story.set(updatedStory);
    });
  }
}
