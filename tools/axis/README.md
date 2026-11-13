# AXIS scenarios for the Storyblok CLI

Proof of concept: scores how well coding agents use the `storyblok` CLI with
[AXIS](https://axis.run). Each scenario gives an agent a task, runs it in an isolated workspace, and
has an LLM judge grade the result against a rubric.

## Run

```bash
tools/axis/run.sh                 # all scenarios
tools/axis/run.sh -s 'offline/*'  # a subset
npx @netlify/axis reports latest --html
```

`run.sh` builds the CLI, packs it, and installs the tarball outside the repo, so agents see what an
npm user gets. Workspace dependencies resolve to their published versions, so unreleased changes in
them are not exercised.

- **Agent auth:** without `ANTHROPIC_API_KEY`, AXIS copies your local Claude Code login (macOS
  Keychain) into the isolated agent home, so a subscription works.
- **`offline/*`:** no Storyblok space needed.
- **`space/*`:** need `.env.qa-engineer-manual` in the repo root (see the `qa-engineer-manual`
  skill). They are skipped without it. `beforeAll` wipes the QA space and seeds `has-stories`; each
  scenario logs the CLI in during setup, so the token never enters the agent's environment.
  Scenarios run with concurrency 1 because they share the space.

Reports land in `.axis/reports/`. Setup and teardown notes (e.g. the component schema read back from
the space after the run) are in each result's `setupOutput`/`teardownOutput`.
