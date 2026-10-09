# @storyblok/accessibility-checker

Accessibility checks for the Storyblok Visual Editor. It runs
[axe-core](https://github.com/dequelabs/axe-core) in your website when the Visual Editor requests a
check, and sends the results to the editor's A11y tab. It works with any framework, and also as an
[`@storyblok/js`](https://www.npmjs.com/package/@storyblok/js) plugin.

## Installation

```sh
npm install @storyblok/accessibility-checker
```

## Usage

Create a checker and enable it in code that runs in the browser:

```ts
import { createAccessibilityChecker } from "@storyblok/accessibility-checker";

const accessibilityChecker = createAccessibilityChecker();
accessibilityChecker.enable();

// Later, for example when a component unmounts:
accessibilityChecker.disable();
```

`enable()` starts the checker only inside the Visual Editor: when the page is framed and its URL has
the `_storyblok` parameter. Everywhere else, including on the server, it does nothing. axe-core is
bundled with your website as a separate chunk and loaded only when the editor requests the first
check.

`enable()` and `disable()` are safe to call repeatedly. Enabling a checker disables any other
checker on the page.

### With `storyblokInit`

If you use `@storyblok/js` or an SDK that passes `use` through (Vue, React, Svelte), you can add the
checker as a plugin instead. It is enabled when `storyblokInit` runs:

```ts
import { storyblokInit } from "@storyblok/js";
import { createAccessibilityCheckerPlugin } from "@storyblok/accessibility-checker";

storyblokInit({
  accessToken: "<token>",
  use: [createAccessibilityCheckerPlugin({ ruleTags: ["wcag2a", "wcag2aa"] })],
});
```

Nuxt, Astro, and Angular do not accept custom plugins, so call `createAccessibilityChecker` in
client-side code there, for example in a Nuxt `plugins/accessibility-checker.client.ts`.

### Options

| Option           | Default                                                                            | Description                                                                                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ruleTags`       | `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22a`, `wcag22aa`, `best-practice` | [axe tags](https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#axecore-tags) of the rules to run, such as WCAG levels. A rule runs when it has any of the tags. |
| `allowedOrigins` | `[]`                                                                               | Editor origins allowed to request checks in addition to Storyblok's, as exact origins or patterns, for example `"http://localhost:3000"`.                                 |

## Message protocol

The checker accepts messages only from `window.parent` on an HTTPS origin whose hostname contains
`storyblok` (or one of `allowedOrigins`), and replies to the origin of the request. The types are
exported from the package.

| Direction     | `action`                   | Payload                                                          |
| ------------- | -------------------------- | ---------------------------------------------------------------- |
| page → editor | `accessibilityReady`       | `protocolVersion`, `pluginVersion`. Sent once on start.          |
| editor → page | `accessibilityCheck`       | `requestId`                                                      |
| page → editor | `accessibilityCheckResult` | `requestId`, `result`                                            |
| page → editor | `accessibilityCheckError`  | `requestId`, `error.code`: `check-failed` or `check-in-progress` |
| editor → page | `accessibilityHighlight`   | `findingId`, or `null` to clear the highlight                    |

The result groups findings by category and splits each category into `violations`, `warnings`
(results axe cannot decide without a person), and `passed`. Each finding describes one element,
including the block it belongs to:

```json
{
  "id": "violations-image-alt-0",
  "ruleId": "image-alt",
  "title": "Images must have alternative text",
  "description": "Ensure <img> elements have alternative text or a role of none or presentation",
  "helpUrl": "https://dequeuniversity.com/rules/axe/4.14/image-alt?application=axeAPI",
  "severity": "critical",
  "element": {
    "html": "<img src=\"https://a.storyblok.com/f/1/hero.jpg\">",
    "blockUid": "abc",
    "componentName": "hero"
  }
}
```

## Playground

The playground is a Vue app that loads a story and enables a checker with
`createAccessibilityChecker`. To open it in the Visual Editor:

1. Copy `playground/.env.template` to `playground/.env` and set the preview access token of your
   space.
2. Run `pnpm --filter @storyblok/playground-accessibility-checker dev`.
3. In the space settings, set the preview URL to `https://localhost:5173/`, and open a story. Allow
   local network access if the browser asks for it.

The playground logs every accessibility request it receives from the editor to the browser console.

## Licence

This package is MIT licensed. It depends on [axe-core](https://github.com/dequelabs/axe-core), which
is licensed under the [Mozilla Public License 2.0](https://www.mozilla.org/en-US/MPL/2.0/).
