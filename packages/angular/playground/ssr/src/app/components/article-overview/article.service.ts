import { inject, Injectable } from '@angular/core';
import { StoryblokService, type Story } from '@storyblok/angular';

@Injectable({ providedIn: 'root' })
export class ArticleService {
  private readonly storyblok = inject(StoryblokService);

  async getArticles(): Promise<Story[]> {
    const client = this.storyblok.getClient();
    const { data } = await client.stories.list({
      query: { version: 'draft', starts_with: 'angular/articles/', content_type: 'article' },
    });
    return (data?.stories as Story[]) ?? [];
  }
}
