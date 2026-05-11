import { Component, ChangeDetectionStrategy, inject, OnInit, signal, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { type Story } from '@storyblok/angular';
import { ArticleService } from './article.service';

export interface ArticleOverviewComponentBlok {
  title?: string;
}

@Component({
  selector: 'app-article-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div>
      <h1>{{ blok().title }}</h1>
      @for (article of articles(); track article.uuid) {
        <div>
          <a [routerLink]="'/' + article.full_slug">
            {{ article.content['title'] }}
          </a>
        </div>
      }
    </div>
  `,
})
export class ArticleOverviewComponent implements OnInit {
  readonly blok = input.required<ArticleOverviewComponentBlok>();
  private readonly articleService = inject(ArticleService);
  readonly articles = signal<Story[]>([]);

  async ngOnInit() {
    this.articles.set(await this.articleService.getArticles());
  }
}
