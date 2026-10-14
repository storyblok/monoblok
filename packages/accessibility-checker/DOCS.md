<!--
Staged docs for the docs platform. Delete this file before merging, after the docs platform PR exists.
New page: also add an entry for it in src/config/navigation/reference.ts.
-->

<!-- target: src/content/docs/docs/libraries/js/accessibility-checker/index.mdx#frontmatter -->

```yaml
title: Accessibility Checker
description: Check the accessibility of your website in the Storyblok Visual Editor with axe-core.
```

<!-- target: src/content/docs/docs/libraries/js/accessibility-checker/index.mdx#overview -->

The `@storyblok/accessibility-checker` package runs
[axe-core](https://github.com/dequelabs/axe-core) in your website when the Visual Editor requests a
check. It sends the results to the A11y tab of the Visual Editor. It works with any framework.

Your website is rendered in an iframe on another origin, so the Visual Editor cannot scan its DOM.
The checker runs inside your website and answers the Visual Editor with `window.postMessage`.

<!-- target: src/content/docs/docs/libraries/js/accessibility-checker/index.mdx#installation -->

## Installation

```sh
npm install @storyblok/accessibility-checker
```

<!-- target: src/content/docs/docs/libraries/js/accessibility-checker/index.mdx#usage -->

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
the Visual Editor parameters `_storyblok`, `_storyblok_c`, and `_storyblok_tk[space_id]`. Everywhere
else, including on the server, it does nothing. axe-core is bundled with your website as a separate
chunk and loaded only when the Visual Editor requests the first check.

`enable()` and `disable()` are safe to call repeatedly. Enabling a checker disables any other
checker on the page. `disable()` removes the message listener and the highlight.

In Nuxt, for example, enable the checker in a client-only plugin:

```ts
// plugins/accessibility-checker.client.ts
import { createAccessibilityChecker } from "@storyblok/accessibility-checker";

export default defineNuxtPlugin(() => {
  createAccessibilityChecker({ ruleTags: ["wcag2a", "wcag2aa"] }).enable();
});
```

<!-- target: src/content/docs/docs/libraries/js/accessibility-checker/index.mdx#options -->

## Options

| Option           | Default                                                                            | Description                                                                                                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ruleTags`       | `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22a`, `wcag22aa`, `best-practice` | [axe tags](https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#axecore-tags) of the rules to run, such as WCAG levels. A rule runs when it has any of the tags, so list every level you need.      |
| `allowedOrigins` | `[]`                                                                               | Origins that may request checks in addition to the Visual Editor's, such as a local development server. Exact origin strings (`"http://localhost:3000"`) or regular expressions that match the whole origin. |

`ruleTags` must list at least one tag. If no axe rule has any of the tags, the check fails with the
error code `check-failed`.

A regular expression in `allowedOrigins` must match the whole origin, so anchor it with `^` and `$`.
Without anchors, `/localhost/` also accepts `https://localhost.evil.com`.

<!-- target: src/content/docs/docs/libraries/js/accessibility-checker/index.mdx#message-protocol -->

## Message protocol

The checker accepts messages only from `window.parent` on a Visual Editor origin or one of
`allowedOrigins`, and replies to the origin of the request. The package exports the message and
result types.

| Direction     | `action`                   | Payload                                                                             |
| ------------- | -------------------------- | ----------------------------------------------------------------------------------- |
| page → editor | `accessibilityReady`       | `protocolVersion`, `pluginVersion`                                                  |
| editor → page | `accessibilityCheck`       | `requestId`                                                                         |
| page → editor | `accessibilityCheckResult` | `requestId`, `protocolVersion`, `result`                                            |
| page → editor | `accessibilityCheckError`  | `requestId`, `protocolVersion`, `error.code`: `check-failed` or `check-in-progress` |
| editor → page | `accessibilityHighlight`   | `findingId`, or `null` to clear the highlight                                       |

- `accessibilityReady` is sent on every `enable()`, when the parent origin can be determined and is
  allowed.
- A request without a string `requestId` is ignored.
- Only one check runs at a time. Starting a check clears the current highlight.
- A check that is still running when the checker is disabled never gets a reply, so the editor needs
  its own timeout.
- A highlight request for an unknown finding or a removed element clears the current highlight.

<!-- target: src/content/docs/docs/libraries/js/accessibility-checker/index.mdx#result -->

## Result

The result groups findings by category. It splits each category into `violations`, `warnings`
(results axe cannot decide without a person), and `passed`. Each finding describes one element,
including the block it belongs to. `totalChecks` counts findings (one per element and rule), not
rules.

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
