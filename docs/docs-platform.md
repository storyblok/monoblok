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

## Stage docs in a PR

Internal contributors draft user-facing docs next to the code they describe, so reviewers see both
in one PR:

- **Location:** `packages/<pkg>/DOCS.md`, or `DOCS.md` at the repo root when the docs span packages.
  Never draft them in a README.
- **Content:** Final docs-site content, ready to paste into the target `.mdx`, including Starlight
  components and badges.
- **Target:** Start each section with a marker naming the page and heading it belongs to, for
  example `<!-- target: src/content/docs/docs/libraries/js/richtext/index.mdx#options -->`. Moving
  the docs over is then copy and paste. For a new page, also note the `reference.ts` navigation
  entry.
- **Before merge:** Open the docs platform PR from `DOCS.md` and link it in the monoblok PR. Only
  then delete `DOCS.md`, since it's the only copy of the docs until that PR exists. The
  `staged-docs` CI check fails while any `DOCS.md` exists. A red check is expected while docs are
  staged. It doesn't skip draft PRs, because a skipped required check counts as passing.
