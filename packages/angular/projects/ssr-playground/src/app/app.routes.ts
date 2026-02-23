import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, Routes } from '@angular/router';
import { StoryblokService } from '@storyblok/angular';

export const routes: Routes = [
  {
    path: '',
    title: 'Home | Storyblok Angular',
    loadComponent: () => import('./routes/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: '**',
    title: 'Catch All | Storyblok Angular',
    loadComponent: () =>
      import('./routes/catch-all/catch-all.component').then((m) => m.CatchAllComponent),
    resolve: {
      story: (route: ActivatedRouteSnapshot) => {
        const slug = route.url.map((s) => s.path).join('/') || 'home';
        return inject(StoryblokService).getStory(slug, {
          version: 'draft',
          resolve_relations: 'feature_posts.posts',
        });
      },
    },
  },
];
