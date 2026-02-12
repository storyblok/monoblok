import { Routes } from '@angular/router';

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
  },
];
