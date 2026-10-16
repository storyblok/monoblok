# Blueprints

Source of the template repos `storyblok create` uses. Each folder is synced to the repo of the same
name by `.github/workflows/sync-blueprints.yaml` (see `adr/0020-sync-blueprints-from-the-monorepo.md`).
`AGENTS.storyblok.md` is appended to every blueprint's `AGENTS.md`.

## Adding a blueprint

1. Create `blueprints/<repo-name>/` as a plain npm project: no lockfile, no `.github`, `workspace:^`
   for `@storyblok/*` packages from this repo.
2. Add an `AGENTS.md` with what the app is, the framework docs, and what the project's files don't
   say.
3. Add `tools/blueprint-sync/configs/<repo-name>.ts`.
4. Run `pnpm --filter @storyblok/blueprint-sync verify <repo-name>` (see
   `tools/blueprint-sync/README.md`), and again after every change.

## Syncing

Run the **Sync blueprints** workflow with comma-separated folder names, or `all`. Set `repo-suffix`
to target dry-run repos, for example `-temp`.
