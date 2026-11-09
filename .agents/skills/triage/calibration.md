# Triage calibration

Scores the team has ruled on. Match new tickets against these before scoring.

| Ticket                                                  | Impact / Breadth      | Priority | Why                                                                                                         |
| ------------------------------------------------------- | --------------------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| #164 Nuxt 7.1.1 minimal setup from the docs throws      | blocker / widespread  | P0       | the documented setup renders nothing; regression: worked in 7.1.0                                           |
| #866 CJS build throws on every request                  | critical / common     | P1       | `import()` is a workaround; CJS on Node 22+ is mainstream; regression, not a blocker: worked in 0.7.0       |
| #891 CJS `apiPlugin` throws                             | critical / common     | P1       | patching `dist/index.cjs` is a workaround; not a regression: the UMD build before 6.3.2 failed the same way |
| #808 push drops one field                               | critical / uncommon   | P1       | silent data loss: the next pull overwrites local edits; regression: older CLI works                         |
| #832 bridge never listens on prerendered Nuxt 4.5 pages | degraded / common     | P1       | static Nuxt sites are mainstream; regression: broke with Nuxt 4.5                                           |
| #533 `useStoryblokApi()` hangs Cloudflare Workers       | critical / common     | P1       | plain `fetch()` is a workaround; Workers is a mainstream runtime                                            |
| #206 CLI `types` renamed to `Types` in 4.2.0            | critical / widespread | P1       | `Types` is a workaround; regression, not a blocker: worked in 4.1.0                                         |
| #323 `migration run --dry-run` writes stories           | critical / uncommon   | P1       | writes despite `--dry-run`; regression: worked in 4.5.0                                                     |
| #399 migration run aborts on a logging error            | critical / uncommon   | P2       | one failed story aborts the whole run                                                                       |
| #803 `create` fails on paths with spaces                | critical / uncommon   | P2       | using another path is an easy workaround                                                                    |
| #805 stale attributes in live preview                   | degraded / common     | P2       | updating attributes is a normal flow                                                                        |
| #836 underscore blok names reported missing             | degraded / common     | P2       | normal flow; not a regression: #185 fixed rendering, never the fallback check                               |
| #841 components ignored after hot reload                | degraded / common     | P2       | dev-only; edits to existing components should show                                                          |
| #817 richtext adds 210 kb gzip to the browser bundle    | degraded / widespread | P2       | a heavy bundle is noticeable                                                                                |
| #727 RSC published pages ship the client registry       | degraded / common     | P2       | performance problem on a working feature                                                                    |
| #796 `components push` drops `preview_tmpl`             | critical / uncommon   | P2       | silent data loss; labeled regression, but no version where it worked                                        |
| #481 `datasources pull` hangs on a space without any    | critical / edge-case  | P2       | hangs CI builds; needs a space with no datasources                                                          |
| #790 generated output fails type-check                  | degraded / uncommon   | P3       | small impact; the size of the fix does not matter                                                           |
| #797 preview template escapes `&&` (fixed)              | degraded / uncommon   | P3       | scored as reported                                                                                          |
| #826 icon names are an untyped string                   | minor / uncommon      | P3       | feature request; a typo only costs the icon                                                                 |
| #827 `defineTab` / `defineGroup` helpers                | minor / uncommon      | P3       | feature request; the editor shows the problem                                                               |
| #425 CLI suggests `--verbose` when it is already set    | minor / common        | P3       | a misleading hint; the error itself is shown                                                                |
