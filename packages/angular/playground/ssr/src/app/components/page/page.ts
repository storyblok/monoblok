import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import {
  SbRichTextComponent,
  type SbBlokData,
  type StoryblokRichTextJson,
  StoryblokComponent,
} from '@storyblok/angular';

export interface PageBlok {
  body?: SbBlokData[];
  richText?: StoryblokRichTextJson;
}

@Component({
  selector: 'app-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SbRichTextComponent, StoryblokComponent],
  template: `
    <div class="space-y-8">
      <sb-component [sbBlok]="bloks()" />
      <sb-rich-text [sbDocument]="richText()" />
    </div>
  `,
})
export class PageComponent {
  readonly blok = input.required<PageBlok>();
  readonly bloks = computed(() => this.blok().body ?? []);
  readonly richText = computed(() => this.blok().richText ?? null);
}
