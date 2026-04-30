<div align="center">

![Storyblok Angular](https://raw.githubusercontent.com/storyblok/.github/refs/heads/main/profile/public/github-banner.png)

<h1 align="center">@storyblok/angular</h1>
  <p align="center">
    The Angular SDK to interact with <a href="http://www.storyblok.com?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-angular" target="_blank">Storyblok API</a> and enable the <a href="https://www.storyblok.com/docs/guide/essentials/visual-editor?utm_source=github.com&utm_medium=readme&utm_campaign=storyblok-angular" target="_blank">Real-time Visual Editing Experience</a>.
  </p>
  <br />
</div>

<p align="center">
  <a href="https://npmjs.com/package/@storyblok/angular">
    <img src="https://img.shields.io/npm/v/@storyblok/angular/latest.svg?style=flat-square&color=8d60ff" alt="Storyblok Angular SDK" />
  </a>
  <a href="https://npmjs.com/package/@storyblok/angular" rel="nofollow">
    <img src="https://img.shields.io/npm/dt/@storyblok/angular.svg?style=flat-square&color=8d60ff" alt="npm">
  </a>
  <a href="https://storyblok.com/join-discord">
   <img src="https://img.shields.io/discord/700316478792138842?label=Join%20Our%20Discord%20Community&style=appveyor&logo=discord&color=8d60ff">
   </a>
  <a href="https://twitter.com/intent/follow?screen_name=storyblok">
    <img src="https://img.shields.io/badge/Follow-%40storyblok-8d60ff?style=appveyor&logo=twitter" alt="Follow @Storyblok" />
  </a><br/>
  <a href="https://app.storyblok.com/#!/signup?utm_source=github.com&utm_medium=readme&utm_campaign=@storyblok/angular">
    <img src="https://img.shields.io/badge/Try%20Storyblok-Free-8d60ff?style=appveyor&logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAYAAAA7MK6iAAAABGdBTUEAALGPC/xhBQAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAHqADAAQAAAABAAAAHgAAAADpiRU/AAACRElEQVRIDWNgGGmAEd3D3Js3LPrP8D8WXZwSPiMjw6qvPoHhyGYwIXNAbGpbCjbzP0MYuj0YFqMroBV/wCxmIeSju64eDNzMBJUxvP/9i2Hnq5cM1devMnz984eQsQwETeRhYWHgIcJiXqC6VHlFBjUeXgav40cIWkz1oLYXFmGwFBImaDFBHyObcOzdW4aSq5eRhRiE2dgYlpuYoYSKJi8vw3GgWnyAJIs/AuPu4scPGObd/fqVQZ+PHy7+6udPOBsXgySLDfn5GRYYmaKYJcXBgWLpsx8/GPa8foWiBhuHJIsl2DkYQqWksZkDFgP5PObcKYYff//iVAOTIDlx/QPqRMb/YSYBaWlOToZIaVkGZmAZSQiQ5OPtwHwacuo4iplMQEu6tXUZMhSUGDiYmBjylFQYvv/7x9B04xqKOnQOyT5GN+Df//8M59ASXKyMHLoyDD5JPtbj42OYrm+EYgg70JfuYuIoYmLs7AwMjIzA+uY/zjAnyWJpDk6GOFnCvrn86SOwmsNtKciVFAc1ileBHFDC67lzG10Yg0+SjzF0ownsf/OaofvOLYaDQJoQIGix94ljv1gIZI8Pv38zPvj2lQWYf3HGKbpDCFp85v07NnRN1OBTPY6JdRSGxcCw2k6sZuLVMZ5AV4s1TozPnGGFKbz+/PE7IJsHmC//MDMyhXBw8e6FyRFLv3Z0/IKuFqvFyIqAzd1PwBzJw8jAGPfVx38JshwlbIygxmYY43/GQmpais0ODDHuzevLMARHBcgIAQAbOJHZW0/EyQAAAABJRU5ErkJggg==" alt="Follow @Storyblok" />
  </a>
</p>

## Features

- Fetch content from the Content Delivery API using `StoryblokService`
- Dynamic component rendering with `SbBlokDirective`
- Real-time Visual Editing with `LivePreviewService`
- Rich text rendering with `SbRichTextComponent`
- Full SSR support with Angular Universal
- Tree-shakeable features for optimal bundle size
- Lazy loading support for Storyblok components

## Installation

Install `@storyblok/angular`:

```bash
npm install @storyblok/angular
# or
pnpm add @storyblok/angular
# or
yarn add @storyblok/angular
```

## Setup

### 1. Configure the SDK

Add the Storyblok provider to your application configuration:

```typescript
// app.config.ts
import { ApplicationConfig } from "@angular/core";
import { provideStoryblok, withStoryblokComponents, withLivePreview } from "@storyblok/angular";

export const appConfig: ApplicationConfig = {
  providers: [
    provideStoryblok(
      {
        accessToken: "YOUR_ACCESS_TOKEN",
        region: "eu", // 'eu', 'us', 'ap', 'ca', or 'cn'
      },
      withStoryblokComponents({
        page: () => import("./components/page").then((m) => m.PageComponent),
        teaser: () => import("./components/teaser").then((m) => m.TeaserComponent),
      }),
      withLivePreview(),
    ),
  ],
};
```

### 2. Create Storyblok components

Create Angular components that match your Storyblok component names:

```typescript
// components/teaser.ts
import { Component, input } from "@angular/core";
import { type SbBlokData } from "@storyblok/angular";

interface TeaserBlok extends SbBlokData {
  headline?: string;
}

@Component({
  selector: "app-teaser",
  template: `<h2>{{ blok().headline }}</h2>`,
})
export class TeaserComponent {
  readonly blok = input.required<TeaserBlok>();
}
```

### 3. Fetch and render content

Use `StoryblokService` to fetch content and `SbBlokDirective` to render it:

```typescript
// routes/home.component.ts
import { Component, inject, signal, OnInit } from "@angular/core";
import { StoryblokService, SbBlokDirective, type SbBlokData } from "@storyblok/angular";

@Component({
  selector: "app-home",
  imports: [SbBlokDirective],
  template: `<ng-container [sbBlok]="content()" />`,
})
export class HomeComponent implements OnInit {
  private readonly storyblok = inject(StoryblokService);
  readonly content = signal<SbBlokData | null>(null);

  async ngOnInit() {
    const client = this.storyblok.getClient();
    const { data } = await client.stories.get("home", {
      query: { version: "draft" },
    });
    this.content.set(data?.story?.content);
  }
}
```

> **Note:** For spaces created in the United States or China, the `region` parameter **must** be specified.

## Live Preview

Enable real-time visual editing in the Storyblok Visual Editor:

```typescript
// app.config.ts
provideStoryblok(
  { accessToken: "YOUR_ACCESS_TOKEN" },
  withLivePreview({
    resolveRelations: ["article.author"],
  }),
);
```

In your route component, listen for live updates:

```typescript
import { Component, inject, linkedSignal, input, OnInit } from "@angular/core";
import { LivePreviewService, SbBlokDirective, type ISbStoryData } from "@storyblok/angular";

@Component({
  imports: [SbBlokDirective],
  template: `<ng-container [sbBlok]="story()?.content" />`,
})
export class CatchAllComponent implements OnInit {
  private readonly livePreview = inject(LivePreviewService);

  readonly storyInput = input<ISbStoryData | null>(null, { alias: "story" });
  readonly story = linkedSignal(() => this.storyInput());

  ngOnInit() {
    this.livePreview.listen((updatedStory) => {
      this.story.set(updatedStory);
    });
  }
}
```

## Render rich text

Use the `SbRichTextComponent` to render rich text fields:

```typescript
import { Component, input } from "@angular/core";
import { SbRichTextComponent, type StoryblokRichTextNode } from "@storyblok/angular";

@Component({
  imports: [SbRichTextComponent],
  template: `<sb-rich-text [doc]="content()" />`,
})
export class ArticleComponent {
  readonly content = input<StoryblokRichTextNode>();
}
```

### Custom rich text components

Override default elements with custom Angular components:

```typescript
// app.config.ts
import { withStoryblokRichtextComponents } from "@storyblok/angular";

provideStoryblok(
  { accessToken: "YOUR_ACCESS_TOKEN" },
  withStoryblokRichtextComponents({
    link: CustomLinkComponent,
    image: OptimizedImageComponent,
  }),
);
```

Create a custom component using the `props` input pattern:

```typescript
import { Component, input, computed } from "@angular/core";
import { SbRichTextNodeComponent, type AngularRenderNode } from "@storyblok/angular";

interface LinkProps {
  href?: string;
  target?: string;
  children?: AngularRenderNode[];
}

@Component({
  imports: [SbRichTextNodeComponent],
  template: `
    <a [href]="href()" [target]="target()" class="custom-link">
      <sb-rich-text-node [nodes]="children()" />
    </a>
  `,
})
export class CustomLinkComponent {
  readonly props = input<LinkProps>({});
  readonly href = computed(() => this.props().href ?? "");
  readonly target = computed(() => this.props().target ?? "_self");
  readonly children = computed(() => this.props().children ?? []);
}
```

## Lazy loading components

Register components with lazy loading for optimal bundle size:

```typescript
const storyblokComponents: StoryblokComponentsMap = {
  page: () => import("./components/page").then((m) => m.PageComponent),
  teaser: () => import("./components/teaser").then((m) => m.TeaserComponent),
  grid: () => import("./components/grid").then((m) => m.GridComponent),
};

provideStoryblok(
  { accessToken: "YOUR_ACCESS_TOKEN" },
  withStoryblokComponents(storyblokComponents),
);
```

## API reference

### Providers

| Provider                                | Description                                               |
| --------------------------------------- | --------------------------------------------------------- |
| `provideStoryblok(config, ...features)` | Configure the SDK with access token and optional features |
| `withStoryblokComponents(map)`          | Register Storyblok components (eager or lazy)             |
| `withLivePreview(options?)`             | Enable real-time visual editing                           |
| `withStoryblokRichtextComponents(map)`  | Register custom rich text components                      |

### Services

| Service              | Description                     |
| -------------------- | ------------------------------- |
| `StoryblokService`   | Access the Storyblok API client |
| `LivePreviewService` | Listen for live preview updates |

### Components and directives

| Component/Directive       | Description                                    |
| ------------------------- | ---------------------------------------------- |
| `SbBlokDirective`         | Dynamically render Storyblok components        |
| `SbRichTextComponent`     | Render rich text content                       |
| `SbRichTextNodeComponent` | Render rich text nodes (for custom components) |

### Types

| Type                    | Description                        |
| ----------------------- | ---------------------------------- |
| `SbBlokData`            | Base type for Storyblok block data |
| `ISbStoryData`          | Story data from the API            |
| `StoryblokRichTextNode` | Rich text document node            |
| `AngularRenderNode`     | Rendered node in rich text AST     |

## Documentation

For complete documentation, visit the [Storyblok Angular SDK documentation](https://www.storyblok.com/docs/packages/storyblok-angular).

## Contributing

If you'd like to contribute, refer to the [contributing guidelines](../../CONTRIBUTING.md).

## Community

For help, discussion about best practices, or any other conversation:

- [Discuss Storyblok on GitHub Discussions](https://github.com/storyblok/monoblok/discussions)
- [Join our Discord Community](https://storyblok.com/join-discord)

## Support

For bugs or feature requests, please [submit an issue](https://github.com/storyblok/monoblok/issues/new/choose).

> [!IMPORTANT]
> Please search existing issues before submitting a new one. Issues without a minimal reproducible example will be closed. [Why reproductions are Required](https://antfu.me/posts/why-reproductions-are-required).

### I can't share my company project code

We understand that you might not be able to share your company's project code. Please provide a minimal reproducible example that demonstrates the issue by using tools like [Stackblitz](https://stackblitz.com) or a link to a GitHub repo. Please make sure you include a README file with the instructions to build and run the project, important not to include any access token, password or personal information of any kind.

### Feedback

If you have a question, please ask in the [Discuss Storyblok on Discord](https://storyblok.com/join-discord) channel.

## License

[License](/LICENSE)
