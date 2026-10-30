# @storyblok/visual-editor-qa

Internal. The shared Playwright harness for manual Visual Editor QA, consumed by the framework
packages' `test/visual-editor` directories. Not published, not built: the framework packages import
the TypeScript sources directly and Playwright transpiles them.

Everything here is framework-agnostic, because the Storyblok app is. What a package supplies is its
own `qa.config.ts`; what it keeps is its specs and its `test/GUIDE.md`.

The Visual Editor checklist in the `qa-engineer-manual` skill explains why each assertion is shaped
the way it is. Read it before changing anything in `src/editor.page.ts`.

## Notes for every package

- The access token must be the key whose `access` is `private`. The playgrounds request
  `version: "draft"`, and a `public` key returns published content only, so a `public` token yields
  empty stories for unpublished seed data, with no error to tell you why.
- Every app-side selector lives in `src/editor.page.ts`. When a Storyblok release breaks the
  harness, that is the file to repair, and the fix lands for every package at once.
- A blank preview frame in your own browser is Chrome, not the bridge. The harness disables the
  Local Network Access checks via launch args; a browser you drive yourself blocks the iframe and
  renders a `chrome-error` page instead.
