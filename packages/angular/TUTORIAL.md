# Build a website with Angular and Storyblok

This tutorial walks you through building a content-driven website using Angular and Storyblok. You will learn how to fetch content, create dynamic components, enable live editing, and render rich text.

## Prerequisites

- Node.js 18 or later
- Angular CLI (`npm install -g @angular/cli`)
- A [Storyblok account](https://app.storyblok.com/#!/signup)

## Create a new Angular project

Create a new Angular project with SSR support:

```bash
ng new my-storyblok-app --ssr
cd my-storyblok-app
```

Install the Storyblok Angular SDK:

```bash
npm install @storyblok/angular
```

## Configure Storyblok

### Get your access token

1. Log in to your Storyblok space
2. Go to **Settings** > **Access Tokens**
3. Copy your **Preview** access token

### Set up the provider

Update your `app.config.ts` to configure the SDK:

```typescript
// src/app/app.config.ts
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import {
  provideStoryblok,
  withStoryblokComponents,
  withLivePreview,
} from '@storyblok/angular';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideStoryblok(
      {
        accessToken: 'YOUR_ACCESS_TOKEN',
        region: 'eu', // Change based on your space region
      },
      withStoryblokComponents({
        // Components will be added here
      }),
      withLivePreview()
    ),
  ],
};
```

## Create Storyblok components

Create a folder structure for your Storyblok components:

```
src/app/
├── components/
│   ├── page/
│   │   └── page.component.ts
│   ├── teaser/
│   │   └── teaser.component.ts
│   ├── grid/
│   │   └── grid.component.ts
│   └── feature/
│       └── feature.component.ts
└── storyblok.components.ts
```

### Page component

The page component serves as a container for other components:

```typescript
// src/app/components/page/page.component.ts
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { SbBlokDirective, type SbBlokData } from '@storyblok/angular';

export interface PageBlok extends SbBlokData {
  body?: SbBlokData[];
}

@Component({
  selector: 'app-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SbBlokDirective],
  template: `
    <div class="page">
      @for (blok of blok().body ?? []; track blok._uid) {
        <ng-container [sbBlok]="blok" />
      }
    </div>
  `,
})
export class PageComponent {
  readonly blok = input.required<PageBlok>();
}
```

### Teaser component

A simple teaser component with a headline:

```typescript
// src/app/components/teaser/teaser.component.ts
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { type SbBlokData } from '@storyblok/angular';

export interface TeaserBlok extends SbBlokData {
  headline?: string;
}

@Component({
  selector: 'app-teaser',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="teaser">
      <h1>{{ blok().headline }}</h1>
    </div>
  `,
  styles: `
    .teaser {
      padding: 2rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-align: center;
      border-radius: 8px;
      margin-bottom: 2rem;
    }
  `,
})
export class TeaserComponent {
  readonly blok = input.required<TeaserBlok>();
}
```

### Grid component

A grid component that renders nested components in columns:

```typescript
// src/app/components/grid/grid.component.ts
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { SbBlokDirective, type SbBlokData } from '@storyblok/angular';

export interface GridBlok extends SbBlokData {
  columns?: SbBlokData[];
}

@Component({
  selector: 'app-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SbBlokDirective],
  template: `
    <div class="grid">
      @for (column of blok().columns ?? []; track column._uid) {
        <ng-container [sbBlok]="column" />
      }
    </div>
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      padding: 1rem 0;
    }
  `,
})
export class GridComponent {
  readonly blok = input.required<GridBlok>();
}
```

### Feature component

A feature card component:

```typescript
// src/app/components/feature/feature.component.ts
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { type SbBlokData } from '@storyblok/angular';

export interface FeatureBlok extends SbBlokData {
  name?: string;
  description?: string;
}

@Component({
  selector: 'app-feature',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="feature">
      <h3>{{ blok().name }}</h3>
      <p>{{ blok().description }}</p>
    </div>
  `,
  styles: `
    .feature {
      padding: 1.5rem;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    .feature h3 {
      margin: 0 0 0.5rem;
      color: #1a202c;
    }
    .feature p {
      margin: 0;
      color: #718096;
    }
  `,
})
export class FeatureComponent {
  readonly blok = input.required<FeatureBlok>();
}
```

### Register components

Create a component registry with lazy loading:

```typescript
// src/app/storyblok.components.ts
import { type StoryblokComponentsMap } from '@storyblok/angular';

export const storyblokComponents: StoryblokComponentsMap = {
  page: () => import('./components/page/page.component').then((m) => m.PageComponent),
  teaser: () => import('./components/teaser/teaser.component').then((m) => m.TeaserComponent),
  grid: () => import('./components/grid/grid.component').then((m) => m.GridComponent),
  feature: () => import('./components/feature/feature.component').then((m) => m.FeatureComponent),
};
```

Update `app.config.ts` to use the component registry:

```typescript
import { storyblokComponents } from './storyblok.components';

// In providers array:
provideStoryblok(
  { accessToken: 'YOUR_ACCESS_TOKEN', region: 'eu' },
  withStoryblokComponents(storyblokComponents),
  withLivePreview()
)
```

## Fetch and display content

### Create a catch-all route

Create a route component that fetches content based on the URL:

```typescript
// src/app/routes/catch-all/catch-all.component.ts
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

@Component({
  selector: 'app-catch-all',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SbBlokDirective],
  template: `
    <div class="container">
      <ng-container [sbBlok]="storyContent()" />
      @if (!storyContent()) {
        <div class="not-found">
          <h2>Page not found</h2>
          <p>The requested page could not be found.</p>
        </div>
      }
    </div>
  `,
  styles: `
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }
    .not-found {
      text-align: center;
      padding: 4rem 2rem;
    }
  `,
})
export class CatchAllComponent implements OnInit {
  private readonly livePreview = inject(LivePreviewService);

  // Story data from route resolver
  readonly storyInput = input<ISbStoryData | null>(null, { alias: 'story' });
  
  // Writable signal that can be updated by live preview
  readonly story = linkedSignal(() => this.storyInput());
  
  readonly storyContent = computed(() => this.story()?.content as SbBlokData | undefined);

  ngOnInit(): void {
    // Enable live preview updates
    this.livePreview.listen((updatedStory) => {
      this.story.set(updatedStory);
    });
  }
}
```

### Set up routing

Configure routes with a resolver to fetch content:

```typescript
// src/app/app.routes.ts
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
```

## Add rich text support

### Create a page with rich text

Update the page component to support rich text fields:

```typescript
// src/app/components/page/page.component.ts
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import {
  SbBlokDirective,
  SbRichTextComponent,
  type SbBlokData,
  type StoryblokRichTextNode,
} from '@storyblok/angular';

export interface PageBlok extends SbBlokData {
  body?: SbBlokData[];
  content?: StoryblokRichTextNode;
}

@Component({
  selector: 'app-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SbBlokDirective, SbRichTextComponent],
  template: `
    <div class="page">
      @for (blok of blok().body ?? []; track blok._uid) {
        <ng-container [sbBlok]="blok" />
      }
      
      @if (blok().content) {
        <div class="rich-text">
          <sb-rich-text [doc]="blok().content!" />
        </div>
      }
    </div>
  `,
  styles: `
    .rich-text {
      max-width: 65ch;
      margin: 2rem auto;
      line-height: 1.7;
    }
  `,
})
export class PageComponent {
  readonly blok = input.required<PageBlok>();
}
```

### Custom link component for rich text

Create a custom link component to handle internal and external links:

```typescript
// src/app/components/richtext/link.component.ts
import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SbRichTextNodeComponent, type AngularRenderNode } from '@storyblok/angular';

interface LinkProps {
  href?: string;
  target?: string;
  linktype?: string;
  children?: AngularRenderNode[];
}

@Component({
  selector: 'app-rich-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SbRichTextNodeComponent, RouterLink],
  template: `
    @if (isInternal()) {
      <a [routerLink]="href()" class="link internal">
        <sb-rich-text-node [nodes]="children()" />
      </a>
    } @else {
      <a [href]="href()" [target]="target()" class="link external" rel="noopener">
        <sb-rich-text-node [nodes]="children()" />
      </a>
    }
  `,
  styles: `
    .link {
      color: #667eea;
      text-decoration: underline;
    }
    .link:hover {
      color: #764ba2;
    }
  `,
})
export class RichLinkComponent {
  readonly props = input<LinkProps>({});
  
  readonly href = computed(() => this.props().href ?? '');
  readonly target = computed(() => this.props().target ?? '_self');
  readonly linktype = computed(() => this.props().linktype);
  readonly children = computed(() => this.props().children ?? []);
  
  readonly isInternal = computed(() => this.linktype() === 'story');
}
```

Register the custom rich text component:

```typescript
// src/app/app.config.ts
import { withStoryblokRichtextComponents } from '@storyblok/angular';
import { RichLinkComponent } from './components/richtext/link.component';

provideStoryblok(
  { accessToken: 'YOUR_ACCESS_TOKEN', region: 'eu' },
  withStoryblokComponents(storyblokComponents),
  withLivePreview(),
  withStoryblokRichtextComponents({
    link: RichLinkComponent,
  })
)
```

## Handle embedded components in rich text

When you embed Storyblok components inside rich text fields, create a blok component to render them:

```typescript
// src/app/components/richtext/blok.component.ts
import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { SbBlokDirective, type SbBlokData, type AngularRenderNode } from '@storyblok/angular';

interface BlokProps {
  body?: SbBlokData[];
  children?: AngularRenderNode[];
}

@Component({
  selector: 'app-rich-blok',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SbBlokDirective],
  template: `
    @for (blok of body(); track blok._uid) {
      <ng-container [sbBlok]="blok" />
    }
  `,
})
export class RichBlokComponent {
  readonly props = input<BlokProps>({});
  readonly body = computed(() => this.props().body ?? []);
}
```

Register it in the rich text components:

```typescript
withStoryblokRichtextComponents({
  link: RichLinkComponent,
  blok: RichBlokComponent,
})
```

## Resolve relations

When your content references other stories (like an article referencing an author), resolve these relations:

### Configure relation resolution

```typescript
// In your route resolver
const { data } = await client.stories.get(slug, {
  query: {
    version: 'draft',
    resolve_relations: 'article.author,article.categories',
  },
});
```

### Enable live preview for relations

```typescript
provideStoryblok(
  { accessToken: 'YOUR_ACCESS_TOKEN', region: 'eu' },
  withStoryblokComponents(storyblokComponents),
  withLivePreview({
    resolveRelations: ['article.author', 'article.categories'],
  })
)
```

### Use resolved relations in components

```typescript
// src/app/components/article/article.component.ts
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { type SbBlokData, type ISbStoryData } from '@storyblok/angular';

export interface ArticleBlok extends SbBlokData {
  title?: string;
  author?: ISbStoryData; // Resolved relation
  categories?: ISbStoryData[]; // Resolved relations
}

@Component({
  selector: 'app-article',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article>
      <h1>{{ blok().title }}</h1>
      @if (blok().author) {
        <p class="author">By {{ blok().author.content.name }}</p>
      }
      @if (blok().categories?.length) {
        <div class="categories">
          @for (category of blok().categories; track category.uuid) {
            <span class="tag">{{ category.content.name }}</span>
          }
        </div>
      }
    </article>
  `,
})
export class ArticleComponent {
  readonly blok = input.required<ArticleBlok>();
}
```

## Best practices

### Use lazy loading

Register components with lazy loading to reduce initial bundle size:

```typescript
const storyblokComponents: StoryblokComponentsMap = {
  // Good: Lazy loaded
  page: () => import('./components/page').then((m) => m.PageComponent),
  
  // Avoid: Eagerly loaded (increases bundle size)
  // page: PageComponent,
};
```

### Type your blok data

Create interfaces that extend `SbBlokData` for type safety:

```typescript
interface TeaserBlok extends SbBlokData {
  headline?: string;
  description?: string;
  image?: {
    filename: string;
    alt: string;
  };
}
```

### Use signals for reactivity

Angular's signals work well with Storyblok:

```typescript
readonly blok = input.required<TeaserBlok>();
readonly headline = computed(() => this.blok().headline ?? 'Default');
```

### Handle missing content gracefully

Always handle cases where content might not exist:

```typescript
template: `
  @if (blok().image?.filename) {
    <img [src]="blok().image.filename" [alt]="blok().image.alt" />
  }
`
```

## Next steps

- Explore the [Storyblok documentation](https://www.storyblok.com/docs)
- Learn about [image optimization](https://www.storyblok.com/docs/image-service)
- Set up [preview and production environments](https://www.storyblok.com/docs/guide/in-depth/environments)
- Configure [webhooks for cache invalidation](https://www.storyblok.com/docs/guide/in-depth/webhooks)
