# Storyblok Docs Platform

Astro + Starlight docs site. MDX files for API/package reference, Storyblok CMS for guides/manuals.

## Key conventions

- **Library docs:** `src/content/docs/docs/libraries/js/<name>-sdk/` for framework SDKs,
  `js/<name>/` for other packages
- **Versioning:** `index.mdx` = current major, `v<N>.mdx` = previous. Only version when the major
  has actual content/API changes
- **Badge tags:** `<Badge text="X.Y.Z" variant="success" />` with `_Introduced in_` for new minor
  features, `variant="note"` with `_Updated in_` for changes. Remove all badges on new major release
- **Navigation:** `src/config/navigation/reference.ts` for library sidebar entries
- **Always run `pnpm lint`** before pushing — CI checks Prettier, ESLint, and Stylelint
- **Storyblok space IDs:** dev `286748359290148`, prod `212319`
