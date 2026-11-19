# Architecture Decision Records

Earlier ADRs are named `NNNN-slug.md`. With that scheme, parallel PRs could take the same number
without a conflict, which is why ADR-0017 and ADR-0022 each exist twice.

- `0001-no-shared-dependency-between-api-clients.md`: API clients duplicate shared code instead of
  sharing a dependency.
- `0002-use-delete-as-method-name-for-delete-operations.md`: Delete operations are named `delete`,
  generated as `delete_`.
- `0003-remove-change-detection-from-assets-push.md`: `assets push` uploads every asset without
  change detection.
- `0004-openapi-specs-pulled-on-demand.md`: OpenAPI specs are fetched on demand; each consumer
  commits its generated code.
- `0005-components-selective-pull-dependency-semantics.md`: Which groups, tags, and presets a
  selective component pull and push includes.
- `0006-datasource-per-dimension-entry-values.md`: Datasource dimension values are keyed by
  dimension code, not ID.
- `0007-rename-define-component-to-define-block.md`: The schema package uses block terminology
  (`defineBlock`).
- `0008-schema-command-for-code-driven-workflows.md`: A dedicated `schema` command treats schema
  files as the source of truth.
- `0009-schema-push-migration-generation.md`: `schema push` detects breaking changes and offers
  migration files.
- `0010-block-folder-identity-by-name-path.md`: Block folders are identified by their name path.
- `0011-workers-safe-per-second-request-throttle.md`: The request throttle is a per-second sliding
  window that is safe in Workers.
- `0012-experiments-factory-is-a-stateless-config-binding.md`: The experiments factory is stateless;
  operations take `visitorId`.
- `0013-adopt-viteplus.md`: Vite+ is the toolchain for bundling, testing, linting, and formatting.
- `0014-publish-workspace-dependencies-as-caret-ranges.md`: Published runtime dependencies use
  `workspace:^`.
- `0015-pnpm-supply-chain-hardening.md`: pnpm supply chain controls: strict builds and a minimum
  release age.
- `0016-adaptive-and-pluggable-rate-limiting.md`: API clients use an adaptive, pluggable rate
  limiter.
- `0017-block-tag-identity-by-name.md`: Block tags are identified by their exact name.
- `0017-cache-aware-rate-limit-ceiling.md`: The Content API client raises its rate-limit ceiling by
  cache hit share.
- `0018-content-cache-invalidation-by-version-watermarks.md`: The content cache invalidates entries
  by version watermarks.
- `0019-even-pacing-for-origin-bound-traffic.md`: Requests are paced evenly while most traffic
  reaches the origin.
- `0020-cli-stories-find-command.md`: `stories find` queries the Management API, with the Content
  API as an opt-in accelerator.
- `0021-cli-jsonl-pipe-contract.md`: CLI commands pipe complete stories as JSONL.
- `0022-bundle-size-compared-with-the-base-branch.md`: CI compares bundle sizes with the base
  branch.
- `0022-fix-cjs-node-mode-interop.md`: A shared plugin fixes CJS node-mode interop for external
  imports.
- `0023-sync-blueprints-from-the-monorepo.md`: Blueprints live in the monorepo and sync to their own
  repositories.
- `0024-deprecate-cjs.md`: CJS is deprecated and gets fixes only until the next major versions drop
  it.
- `0025-astro-drop-v4-peer-support.md`: `@storyblok/astro` drops Astro 3 and 4 from its peer range.
- `0026-sync-blueprints-without-approval.md`: The blueprint sync runs without an approval.
- `0027-cli-live-ui-follows-both-streams.md`: CLI progress bars and spinners draw only when stderr
  is a terminal and stdout is not a pipe.
- `adr-0028.md`: New ADRs are named by number only, so a reused number causes a merge conflict.
- `adr-0031.md`: CLI telemetry is opt-in, asked once, and never collects content.
