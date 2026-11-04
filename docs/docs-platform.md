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

## Library references

A package's reference page on the docs site is written here, in plain Markdown, and synced to the
docs platform when the package is published:

- **Location:** `packages/<pkg>/docs/reference.md`, plus `docs/migrations/<slug>.md` for each
  migration guide. One file per package, not per version: the release tag pins the version.
- **Template:** Frontmatter with `title` and `description`, an H1 that matches the title, an intro,
  then `Requirements` (optional), `Installation`, `Usage`, `TypeScript` (optional), the API
  sections, and `Further resources` (optional, a list of `- [Title](url)—Description`).
- **Markdown only:** No HTML or MDX components. Use GitHub alerts (`> [!NOTE]`) for asides and
  absolute `https://www.storyblok.com/docs/...` URLs for links, so the file reads the same on
  GitHub, on npm, and on the docs site.
- **Checks:** `node tools/docs-check.mjs` checks the template. CI also runs Vale with the docs
  platform's config. Both run in the `library-docs` job.
- **Shipping:** Add `docs` to `files` in `package.json`. After the Publish workflow publishes a
  package with a `docs/reference.md`, it notifies the docs platform, which reads the docs from the
  npm tarball and opens a PR with the regenerated pages.
- **Who reviews what:** The DX team owns the package docs. A DX engineer reviews and merges them in
  the same PR as the code, with no Docs review needed: the template check and Vale are the quality
  gate. Ask the Docs team when a change needs a new section in the template, a new page, or a call
  on wording that the checks can't settle. The sync PR on the docs platform needs a Docs approval
  for now, while the process settles.

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
