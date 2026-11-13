---
title: "@storyblok/example"
description: "@storyblok/example does one thing for Storyblok projects. One sentence, shown in search results."
---

<!--
Template for packages/<pkg>/docs/reference.md. Copy it, then delete these
comments. See docs/docs-platform.md for how the page ships and syncs, and run
`node tools/docs-check.mjs` to check it.

- Frontmatter: title and description only. The title is the package name.
- Markdown only: no HTML or MDX components. Comments like this one are fine;
  the docs platform drops them.
- Links: absolute URLs (https://www.storyblok.com/docs/...), never relative
  paths or repository files.
- Asides: GitHub alerts (> [!NOTE], [!TIP], [!IMPORTANT], [!WARNING],
  [!CAUTION]) on a line of their own.
- Code blocks: always add a language.
- Don't add a "Previous versions" section. The docs platform adds a version
  switcher to every library page.
-->

# @storyblok/example

One or two sentences on what the package does and when to use it. Link to the guide or concept page that covers the bigger picture.

<!-- Optional. Runtime, framework, and peer dependency versions. -->

## Requirements

- Node.js 20 or later
- A Storyblok space with a Content Delivery API access token

## Installation

```bash
npm install @storyblok/example
```

<!--
Recommended. The shortest working setup, then subsections for common tasks.
Leave it out when the API section already starts with the entry point.
-->

## Usage

```js
import { example } from "@storyblok/example";

example({ accessToken: "YOUR_ACCESS_TOKEN" });
```

<!--
One H3 per export, named as it's imported, in backticks. Each one has a short
description, a code example, and a parameter table where it takes options.

Mark a function, option, or behavior added or changed in a minor release with
a version line right under its heading. The docs platform renders it as a
badge. Use the version it shipped in, within the current major only, and
remove all of them on the next major:

  _Introduced in 1.2.0_
  _Updated in 1.3.0_
  _Deprecated since 1.4.0_
-->

## API

Every export, in the order a project uses them.

### `example`

_Introduced in 1.2.0_

What it does, in one or two sentences.

```js
example(options);
```

| Option        | Type     | Default | Description                      |
| ------------- | -------- | ------- | -------------------------------- |
| `accessToken` | `string` |         | Required. The space’s API token. |

> [!NOTE]
> Anything the reader must know before using it.

<!--
Optional, any number. Topics that don't belong to one export: caching, error
handling, framework integration. TypeScript usage goes here too, under
"TypeScript".
-->

## TypeScript

How to type the package’s inputs and outputs.

<!--
Optional, always last. Only list items in this exact shape: the docs platform
turns them into cards.
-->

## Further resources

- [Example guide](https://www.storyblok.com/docs/guides/example)—Build a project with @storyblok/example step by step.
