# ADR-0020: Sync Blueprints from the Monorepo

**Status:** Accepted  
**Date:** 2026-10-15

## Context

`storyblok create` scaffolds projects from public template repos (`storyblok/blueprint-core-*`,
`storyblok/blueprint-business-*`). Each lived on its own, with its own Dependabot and pinned
`@storyblok/*` versions, and nothing checked that it still worked with the SDKs released from here.
Users of these repos want a plain npm project: no CI config, no test tooling, no lockfile.

## Decision

**Blueprint sources live in `blueprints/<repo-name>/`. `.github/workflows/sync-blueprints.yaml`
verifies each one as users get it, and only then pushes it to `main` of `storyblok/<repo-name>`.**

1. **The folder name is the repo name**, so repo names are searchable here. A `repo-suffix` input
   targets dry-run repos.
2. **The target mirrors the folder**, dotfiles included, minus what its `.gitignore` ignores. Two
   files are generated:
   - `package.json` with `workspace:^` rewritten to `^<workspace version>`, as `pnpm pack` would
     (ADR-0014).
   - `AGENTS.md`: the blueprint's framework part, then `blueprints/AGENTS.storyblok.md`. A block a
     framework maintains itself (Next.js) stays unchanged at the top. The sync fails when the file
     mentions an npm script `package.json` lacks.
3. **Verify before push.** `tools/blueprint-sync verify` runs `npm install`, build, and start in a
   fresh directory, then checks the demo story in the runner's Chrome: no page errors, no
   `console.error`, expected texts rendered, and hydration for server-rendered blueprints.
   Contributors run the same command locally. A red run never touches a target.
4. **Commit `chore: sync (source: <sha>)`**, or nothing when nothing changed. No releases, no tags,
   no `.github`, no lockfile in the targets.
5. **A GitHub App token** per matrix job, scoped to one repo with `contents: write`. Only the push
   step sees it, so install scripts cannot read it.
6. **Two environments:** `blueprint-sync-approval` has the required reviewers and no secrets, and
   one `approve` job uses it. `blueprint-sync` holds the secrets and has no reviewers. Reviewers on
   the matrix job's environment would ask once per blueprint.
7. **Manual trigger**, plus `workflow_call` so `publish.yaml` can chain it after a release.
8. **Blueprints are not workspace members.** nx ignores them, and the root `oxlint` and `vp fmt`
   skip them because they ship their own ESLint and Prettier config.

## Alternatives Considered

- **PR to the target with CI there, auto-merged.** Rejected: puts `.github` and Playwright in every
  user's project, and a red PR left open is a stale template.
- **Blueprints as workspace members, resolved with `pnpm pack`.** Rejected after trying it: adding
  them re-resolved the monorepo lockfile, moved existing packages, and failed `trustPolicy`
  (ADR-0015) on old versions from existing tooling. Every blueprint dependency bump would churn the
  monorepo lockfile.
- **A personal access token.** Rejected: long-lived, tied to a person, and scoped to all they can
  reach.
- **Lockfiles in the targets.** Rejected: stale between syncs. A new project should get a fresh
  install, which is what verification runs.

## Consequences

- This repo owns blueprint dependency updates and has no Dependabot or Renovate config yet.
- Blueprint dependencies bypass ADR-0015's install-time checks. Verification installs them as a user
  would, so the smoke test is the only gate.
