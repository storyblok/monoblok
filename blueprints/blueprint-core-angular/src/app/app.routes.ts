import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, Routes } from '@angular/router';
import { StoryblokService } from '@storyblok/angular';

export const routes: Routes = [
  {
    path: '**',
    loadComponent: () =>
      import('./routes/catch-all/catch-all.component').then((m) => m.CatchAllComponent),
    resolve: {
      story: async (route: ActivatedRouteSnapshot) => {
        const slug = route.url.map((s) => s.path).join('/') || 'home';
        const client = inject(StoryblokService).getClient();
        const { data } = await client.stories.get(slug, {
          query: { version: 'draft' },
        });
        return data?.story;
      },
    },
  },
];