<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project

A Next.js App Router site that renders Storyblok stories with `@storyblok/react`
(https://www.storyblok.com/docs/packages/storyblok-react). `src/app/[[...slug]]/page.js` fetches the
story for the path, `home` for `/`. Register every new block in `src/lib/storyblok.js`.

`npm run dev` serves https://localhost:3000. The Visual Editor needs HTTPS.
