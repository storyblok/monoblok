import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { type SbBlokData } from '@storyblok/angular';

export interface FeaturePostsBlok extends SbBlokData {
  title?: string;
  articles: SbBlokData[];
}

@Component({
  selector: 'app-feature-posts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],

  template: `
    <div class="p-6 bg-white border border-slate-200 rounded-lg shadow-sm">
      <h3 class="text-xl font-semibold text-slate-800">{{ blok().title }}</h3>
      <ul class="mt-4 space-y-2">
        @for (article of blok().articles; track article) {
          <li class="p-4 bg-slate-50 border border-slate-200 rounded">
            <a [routerLink]="'/' + article['full_slug']">
              <h4 class="text-lg font-medium text-slate-700">{{ article['name'] }}</h4>
            </a>
          </li>
        }
      </ul>
    </div>
  `,
})
export class FeaturePostsComponent {
  readonly blok = input.required<FeaturePostsBlok>();

  ngOnInit() {
    console.log(this.blok());
    // console.log('blok value:', this.blok());
  }
}
