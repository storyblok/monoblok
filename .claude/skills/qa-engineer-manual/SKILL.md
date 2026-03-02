---
name: qa-engineer-manual
description: Plan and perform manual tests for Storyblok monoblok packages against a real, seeded Storyblok space
---

# QA Engineer for Manual Testing

Use this skill when the user requests manual testing of features. We try to have good unit test coverage too, so focus on testing features that are heavily dependent on the usage and behavior of the Storyblok API.

- Create and execute plans for manually testing and validating the requested feature.
- Seed Storyblok QA spaces with reproducible test scenarios.
- Reproduce and investigate bug reports.
- Provide thoughtful feedback regarding incomplete, broken, or missing features.
- Packages might define additional guidelines in `./packages/PACKAGE_NAME/test/GUIDE.md`.

## Preparation

1. Run `pnpm nx build PACKAGE_NAME` to build the latest version of the package(s).
2. Create a comprehensive test plan based on the assignment.
   - Focus on what's best tested manually, not on what is already well covered by unit tests.
   - Test all happy paths.
   - Test error scenarios.
   - Consider possible edge cases.

## Seed and cleanup

You seed Storyblok QA spaces with predefined test scenarios. The space is always cleaned (all content deleted) before seeding. Packages might define scenario data in `./packages/PACKAGE_NAME/test/scenarios/`.

### Prerequisites

- Storyblok CLI built: `pnpm nx build storyblok`
- `.env.qa-engineer-manual` file in repo root with `STORYBLOK_TOKEN` and `STORYBLOK_SPACE_ID`

```bash
# .env.qa-engineer-manual
STORYBLOK_TOKEN=your_personal_access_token
STORYBLOK_SPACE_ID=your_space_id
```

### Built-in scenarios

| Scenario | Use when | Space state after seed |
|---|---|---|
| `has-default-components` | Never manually — pushed automatically as a dependency before every scenario | 4 components (page, blog, hero, cta) |
| `has-stories` | Testing pull/push with realistic cross-references, asset references, nested blocks | 4 components, 10 stories, 2 assets, 1 datasource |
| `has-many-stories` | Load/bulk testing with many stories | 4 components, 150 stories |
| `has-many-assets` | Load/bulk testing with many assets | 4 components, 150 assets |

### Seed a scenario

```bash
bash .claude/skills/qa-engineer-manual/scripts/seed-scenario.sh \
  --scenario has-stories
```

Seeding always cleans the space first (deletes all stories, components, assets, and asset folders), then pushes the scenario data. The space is read from `STORYBLOK_SPACE_ID` in the environment (loaded from `.env.qa-engineer-manual`). You can override it with `--space <id>`.

Packages might define their own scenarios in `./packages/PACKAGE_NAME/test/scenarios`. You can find additional information about these scenarios in `./packages/PACKAGE_NAME/test/scenarios/SCENARIOS.md`.

### Seed an external scenario (`--scenario-dir`)

Use `--scenario-dir` to point at a scenarios directory outside of qa-engineer-manual — for example, scenarios defined by a package in its `./test/scenarios` directory.

```bash
bash .claude/skills/qa-engineer-manual/scripts/seed-scenario.sh \
  --scenario has-rich-content \
  --scenario-dir packages/migrations/test/scenarios
```

External scenarios follow the same structure as built-in ones. Default components from qa-engineer-manual are always staged first, then scenario-local components (if any) override/extend them.

### Skip specific resource types

```bash
bash .claude/skills/qa-engineer-manual/scripts/seed-scenario.sh \
  --scenario has-stories \
  --skip-datasources
```

Flags: `--skip-components`, `--skip-datasources`, `--skip-assets`, `--skip-stories`

### Seed without cleaning (`--no-clean`)

By default, seeding wipes the space first. Use `--no-clean` to push additively — useful for layering multiple scenarios or adding data to an existing space.

```bash
bash .claude/skills/qa-engineer-manual/scripts/seed-scenario.sh \
  --scenario has-stories

# Later, add more data without wiping:
bash .claude/skills/qa-engineer-manual/scripts/seed-scenario.sh \
  --scenario has-many-assets --no-clean --skip-components
```

### Clean up a space

```bash
bash .claude/skills/qa-engineer-manual/scripts/cleanup-remote.sh
```

Deletes all stories, components (except the default `page` component), assets, and asset folders in the space. Uses `STORYBLOK_SPACE_ID` from env by default (override with `--space <id>`). This runs automatically before every seed, but can also be used standalone.

### Scenario structure

A scenario is a directory with optional subdirectories for each resource type:

```
scenarios/
  my-scenario/
    components/        # Optional: JSON files, override/extend default components
      rich-text.json
    stories/            # Optional: JSON files for stories
      home.json
    datasources/        # Optional: JSON files for datasource entries
      categories.json
    assets/             # Optional: asset files to push
      image.png
    generate.sh         # Optional: dynamic generator (replaces static files)
```

- **Components**: Always merged with qa-engineer-manual's `has-default-components` (page, blog, hero, cta). Scenario-local components override defaults with the same filename.
- **generate.sh**: If present, runs instead of copying static files. Receives `staging_dir` and `fake_id` as arguments.
- **All component JSON files** must include `"component_group_uuid": null` to satisfy the CLI's `findComponentSchemas` check.

## Perform tests

**Tests MUST run sequentially, one at a time.** Many tests depend on a specific scenario being seeded in the QA space. Running tests in parallel causes race conditions where one test re-seeds the space while another is mid-flight, leading to false failures. Execute each test group fully before moving to the next.

- Clean up local artifacts with `./scripts/cleanup-local.sh`. Don't hesitate to clean up between tests to start with a clean slate.
- Place test scripts in `./.claude/tmp/`. Import from the built package: `../../packages/PACKAGE_NAME/dist/index.mjs`.
- Export env vars before running: `set -a && source ./.env.qa-engineer-manual && set +a && node ./.claude/tmp/test-name.mjs`.
- Create the MAPI client with `new ManagementApiClient({ token: { accessToken: token } })` — the token must be wrapped in `{ accessToken: ... }`. Do NOT use `createClient` directly.
- The stories list endpoint does NOT return `content` by default — `story.content?.component` will be `undefined` in list responses. Fetch individual stories for full content.
- When using two spaces (for example, mapping references between source and target), use `STORYBLOK_SPACE_ID_TARGET` for the target (loaded via `.env.qa-engineer-manual`).

## Helper scripts

These scripts provide inspection and cleanup during manual tests. Each script loads `.env.qa-engineer-manual` automatically.
Paths are relative to this `SKILL.md`.

| Script | Purpose |
| --- | --- |
| `./scripts/cleanup-local.sh` | Deletes local QA artifacts in `.storyblok/`. |
| `./scripts/cleanup-remote.sh` | Deletes all stories, components (except `page`), assets, and asset folders in the space. Accepts `--space <id>`. |
| `./scripts/list.sh` | Lists resources in the QA space. Pass `--resource stories\|assets\|components\|datasources` and optionally `--space <id>`. |
| `./scripts/generate-story.sh` | Writes a story JSON to stdout. All fields optional — use flags to override `--slug`, `--name`, `--component`, `--parent-id`, `--is-folder`, `--id`, `--uuid`. |
| `./scripts/generate-asset.sh` | Writes an asset sidecar JSON to stdout. Use `--filename`, `--alt`, `--title`, `--is-private`, `--folder-id`. Pass `--copy-png <path>` to also copy the template PNG to a target path. |

## Troubleshooting

- Load the `STORYBLOK_SPACE_ID`, `STORYBLOK_SPACE_ID_TARGET`, `STORYBLOK_ASSET_TOKEN`, `STORYBLOK_ASSET_TOKEN_TARGET` and `STORYBLOK_TOKEN` environment variables by running `source ./.env.qa-engineer-manual` (do not attempt to read this file).
- When running `.mjs` test files, env vars must be **exported** (`set -a && source ./.env.qa-engineer-manual && set +a`) — plain `source` does not propagate to `node` subprocesses.

**MAPI:**
- **Assets list does NOT support `sort_by`** — passing `sort_by: 'id:asc'` returns HTTP 422 and `data: undefined`.

**CLI:**
- **`--asset-token` requires an `asset`-type API key** — Only a token with access type `asset` works. Use `STORYBLOK_ASSET_TOKEN` or `STORYBLOK_ASSET_TOKEN_TARGET` environment variables.

## Output

The final output must:

1. Provide thoughtful feedback regarding incomplete, broken, or missing features.
2. List all findings.

When test scripts print machine-readable JSON, use this standardized shape:

```json
{
  "outcome": "PASS | FAIL",
  "function": "getAllStories",
  "total": 0,
  "returned": 0,
  "requestedPages": [1],
  "details": "optional human-readable context"
}
```

### Review template

Use the following template for the manual test review output:

```md
# [Function Group] Test Results

- **Functions:** [e.g., `getAllStories`, `getAllAssets`]
- **Outcome:** [PASS / FAIL / PARTIAL]
- **QA Space ID:** `$STORYBLOK_SPACE_ID`

## Test execution

- [ ] [Brief description of step 1].
- [ ] [Brief description of step 2].

## Findings & observations

- **Issue or bug:** [Description of what failed or behaved unexpectedly].
- **Shape observation:** [Feedback on data structure compatibility].

## Recommendations

- [Suggestions for improvements or missing features].
```
