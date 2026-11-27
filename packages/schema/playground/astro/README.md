# Schema Astro Playground

Astro site whose blocks, datasources, and content come from a code-defined schema in `src/schema/`,
for manually testing `@storyblok/schema` with the `storyblok schema` commands.

Set `STORYBLOK_SPACE_ID`, `STORYBLOK_TOKEN` (personal access token, for `seed`), and
`STORYBLOK_PREVIEW_TOKEN` (for `dev`), and log in with the CLI. Then run from this directory:

- `pnpm seed`: clean the space and push the schema, datasources, assets, and stories
- `pnpm schema:push`, `pnpm schema:init`, `pnpm schema:rollback`: run the schema commands
- `pnpm dev`: start the site
