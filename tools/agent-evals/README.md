# Agent Evals

Internal tooling that measures whether the repo's skills (`.agents/skills/`) make a coding agent
better at monoblok work than no skills, or than a general-purpose skill set. It uses
[AXIS](https://axis.run) (`@netlify/axis`, pinned) and runs locally on your Claude Code
subscription. The results decide which skills to keep, rewrite, or delete.

## What it measures

Each scenario gives an agent a task in an isolated workspace and grades the result. The same task
runs once per arm:

| Arm           | Skills and agents                         |
| ------------- | ----------------------------------------- |
| `bare`        | none                                      |
| `monoblok`    | `.agents/skills/*` and `.claude/agents/*` |
| `superpowers` | superpowers v6.4.1, loaded as a plugin    |

All arms use `claude-opus-5-5`. The copied skills and agents have `model` and `effort` stripped from
their frontmatter, so arms differ in content only, not in model routing. The judge also uses
`claude-opus-5-5`. The simulated user of the `spec` profile uses `claude-sonnet-5-5`.

Three profiles select the scenarios:

| Profile  | Scenarios                                                                                         | Concurrency |
| -------- | ------------------------------------------------------------------------------------------------- | ----------- |
| `skills` | 16 cases × 3 arms: `investigate`, `qa-engineer-unit`, `plan-implement`, `review-and-qa`, `triage` | 3           |
| `spec`   | 2 cases × 3 arms, answered by a simulated user                                                    | 3           |
| `cli`    | CLI usage scenarios, `bare` arm only                                                              | 1           |

Every `skills` and `spec` scenario replays a merged fix or feature from the repo history. Each case
runs as one variant per arm (`<skill>@<case>--<arm>`), and every prompt invokes that arm's skill
explicitly on the same task text. Auto-triggering is not measured: the suites show how good the
skills are when invoked, not whether an agent picks them.

| Scenario           | `monoblok`              | `superpowers`                                |
| ------------------ | ----------------------- | -------------------------------------------- |
| `investigate`      | `/investigate`          | `/superpowers:systematic-debugging`          |
| `plan-implement`   | `/plan`, then implement | `/superpowers:writing-plans`, then implement |
| `qa-engineer-unit` | `/qa-engineer-unit`     | `/superpowers:test-driven-development`       |
| `review-and-qa`    | `/review-and-qa`        | `/superpowers:requesting-code-review`        |
| `triage`           | `/triage`               | plain task (no matching skill)               |
| `spec`             | `/spec`                 | `/superpowers:brainstorming`                 |

The `bare` arm always gets the plain task.

### Objective checks and judge

Two kinds of grade combine per run:

- **Objective checks** run in teardown and write `.agent-evals/grade.json` into the workspace, for
  example "the findings name a file the fix touched", "the new test fails without the fix", or
  "hidden tests pass". Missing grades count as failures. `cli/` and `spec/` have no objective checks
  and show `n/a`.
- **Judge criteria** grade the transcript against a rubric. Every criterion needs an explicit
  `weight`, because AXIS drops unweighted criteria. A discovery test enforces this.

### Workspaces

Each workspace is a one-commit export from a bare mirror in `tools/agent-evals/.cache/monoblok.git`,
so no other commit is in its git history. Scenarios that start before the fix (`investigate`,
`plan-implement`, `triage`, `spec`) export the case's `preFixRef` and keep its commit message.
Scenarios that start from the fixed code (`qa-engineer-unit`, `review-and-qa`) export its `fixRef`
under the neutral message `chore: snapshot`, so `git log` does not describe the fix, and revert
every non-source file of the fix (tests, snapshots), but never a `package.json` or `pnpm-lock.yaml`.
Skills, agents, and project settings are stripped at any depth. `.claude/rules` and `AGENTS.md`
stay, because real sessions have them. Setup installs dependencies and builds. The resulting
baseline is recorded in `.agent-evals/baseline`.

`run.sh` exports `npm_config_store_dir` as the store the repo's own install uses, so setup and agent
installs share one warm pnpm store. AXIS kills a setup script after 3 minutes. A cold store can
exceed that, so warm it before a large run by running a single case first.

## Run

```bash
tools/agent-evals/run.sh -p skills --runs 3              # every skill scenario, three runs each
tools/agent-evals/run.sh -p skills -s 'skills/investigate@*' --runs 1
tools/agent-evals/run.sh -p skills -a bare,monoblok      # limit the arms
tools/agent-evals/run.sh -p skills --concurrency 2       # lower the parallelism
tools/agent-evals/run.sh -p spec
npx @netlify/axis reports latest --html
```

`run.sh` generates the arm trees, creates or updates the mirror and the superpowers checkout, and
then calls `axis run`, so every other `axis run` flag works. Use at least `--runs 3` for decisions,
so the spread between runs is visible.

Reports land in `.axis/reports/`. Each report holds a `comparison.md` that joins the objective
grades with the AXIS scores.

### Time and cost

Measured on a warm pnpm store:

- Workspace install and build: about 29 seconds.
- `spec` smoke run, two arms: about 6 minutes. The simulated user stops after 16 turns, and a "turn
  limit reached" note in the transcript marks a truncated run.
- Full matrix of one skill (`investigate`: 4 arms × 3 cases × 1 run = 12 jobs, concurrency 3): about
  14 minutes (832 s), about USD 0.29–0.57 per job as reported by Claude Code.

All runs draw on your Claude Code subscription. Every scenario multiplies by three arms and by
`--runs`, so lower `--concurrency` if you hit rate limits.

## Read the results

`comparison.md` has one row per skill and arm:

| Column             | Meaning                                     |
| ------------------ | ------------------------------------------- |
| Runs               | Number of runs behind the row               |
| Objective pass     | Share of runs whose objective checks passed |
| AXIS score         | Mean judge score                            |
| Cost (USD), Tokens | Mean cost and mean token use per run        |

Decision rule per skill: keep it if `monoblok` beats `bare` by more than the measured noise band on
its scenarios, or matches it at clearly lower token cost. Otherwise rewrite it, or delete it if
`superpowers` matches or beats it.

## Add a case

For a bug case used by `investigate`, `qa-engineer-unit`, `plan-implement`, `review-and-qa`, and
`triage`:

1. Add the data to `src/cases.ts`: issue number, package, source files, test files, test runner, and
   issue labels. Verify the refs: `fixRef` must be on `origin/main` and its only parent must be
   `preFixRef`.
2. Run `scripts/fetch-fixtures.sh` to write the public issue text into `fixtures/issues/`. Scrub
   text that reveals the fix, such as links to the pull request or a proposed patch.
3. Add the case id to the list in the scenario file of each skill that should use it, in
   `scenarios/skills/<skill>.ts`.

For a `spec` case, add the data to `src/spec-cases.ts`, the request to `fixtures/requests/<id>.md`,
and the simulator brief to `fixtures/briefs/<id>.md`. The brief lives outside the workspace. Write
public text only.

## Add a skill scenario

1. Create the scenario factory in `src/scenarios/<skill>.ts`, modeled on `investigate.ts`. It maps
   cases to one AXIS variant per arm (`armVariants`) with a `setup` (`prepare`), a prompt that
   invokes each arm's skill (`invokeSkill`), optional teardown scripts that write the grade, and
   weighted judge criteria. Include `NO_UPSTREAM_CHECK`.
2. Add `scenarios/skills/<skill>.ts` that calls the factory with a list of cases.
3. Put new objective checks in `scripts/` and cover them in `test/`.

## CLI suite

The `cli` profile scores how well coding agents use the `storyblok` CLI.

```bash
tools/agent-evals/run.sh -p cli                     # all CLI scenarios
tools/agent-evals/run.sh -p cli -s 'cli/offline/*'  # a subset
```

`run.sh` builds the CLI, packs it, and installs the tarball outside the repo, so agents see what an
npm user gets. Workspace dependencies resolve to their published versions, so unreleased changes in
them are not exercised.

- **Agent auth:** without `ANTHROPIC_API_KEY`, AXIS copies your local Claude Code login (macOS
  Keychain) into the isolated agent home, so a subscription works.
- **`cli/offline/*`:** no Storyblok space needed.
- **`cli/space/*`:** need `.env.qa-engineer-manual` in the repo root (see the `qa-engineer-manual`
  skill). They are skipped without it. `beforeAll` wipes the QA space and seeds `has-stories`; each
  scenario logs the CLI in during setup, so the token never enters the agent's environment.
  Scenarios run with concurrency 1 because they share the space.

Setup and teardown notes, such as the component schema read back from the space after the run, are
in each result's `setupOutput` and `teardownOutput`.

## Known limits

- Agents can still browse GitHub and find the upstream fix. Prompts forbid it, and the judge
  criterion `NO_UPSTREAM_CHECK` (weight 3) catches it after the fact.
- The mirror sits in `tools/agent-evals/.cache/monoblok.git` in your checkout. An agent that
  searches the disk could find the full history.
- The mutation check passes on any non-zero exit without the fix. A test that relies on an export
  the revert removes passes it too.
- A failed workspace setup aborts the whole run. One install failure under concurrency 3 did not
  reproduce on rerun; start the run again.
- AXIS token counts exclude cache reads and possibly subagent usage. Compare cost (USD), not tokens.
- Single runs do not separate arms. Use `--runs 3`.
- Results depend on the model and on the superpowers version. Compare reports only within one pinned
  configuration.
