# @storyblok/blueprint-sync

Internal. Stages and verifies the blueprints in `blueprints/` for
`.github/workflows/sync-blueprints.yaml`. CI runs the same commands as a local run.

## Verify a blueprint

Run after every change to a blueprint, its config in `configs/`, or
`blueprints/AGENTS.storyblok.md`:

```sh
cp tools/blueprint-sync/.env.template tools/blueprint-sync/.env   # once, then add the token
pnpm --filter @storyblok/blueprint-sync verify blueprint-core-nextjs
```

`verify` stages the blueprint into a new temp directory as the sync would push it, runs
`npm install`, builds, starts, and checks the demo story in your installed Chrome. Pass a directory
as the second argument to choose where.

The token is the read-only delivery token of the shared blueprint demo space, the
`STORYBLOK_DELIVERY_API_TOKEN` variable of the `blueprint-sync` GitHub environment. The token in
`.env.qa-engineer-manual` belongs to your own QA space, which lacks the demo content.

`stage <blueprint> <dir>` writes only what the sync pushes, without installing or checking.

npm 10.9.7 crashes installing `blueprint-core-angular`
(`Cannot read properties of null (reading 'edgesOut')`). Use npm 11, which ships with Node 24.
