import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="bg-slate-800 text-white px-8 py-4">
      <nav class="flex justify-between items-center max-w-7xl mx-auto">
        <a routerLink="/" class="text-2xl font-bold hover:opacity-80 transition-opacity">
          Storyblok Angular
        </a>
        <ul class="flex list-none gap-8 m-0 p-0">
          <li>
            <a
              routerLink="/"
              routerLinkActive="underline"
              [routerLinkActiveOptions]="{ exact: true }"
              class="text-white no-underline hover:opacity-80 transition-opacity"
            >
              Home
            </a>
          </li>
          <li>
            <a
              routerLink="/about"
              routerLinkActive="underline"
              class="text-white no-underline hover:opacity-80 transition-opacity"
            >
              About
            </a>
          </li>
        </ul>
      </nav>
    </header>
  `,
})
export class HeaderComponent {}
