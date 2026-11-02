# @storyblok/visual-editor-qa

Internal. The shared Playwright harness for manual Visual Editor QA, consumed by the framework
packages' `test/visual-editor` directories. Not published, not built: the framework packages import
the TypeScript sources directly and Playwright transpiles them.

Everything here is framework-agnostic, because the Storyblok app is. What a package supplies is its
own `qa.config.ts`; what it keeps is its specs and its `test/GUIDE.md`.

The Visual Editor checklist in the `qa-engineer-manual` skill explains why each assertion is shaped
the way it is. Read it before changing anything in `src/editor.page.ts`.
