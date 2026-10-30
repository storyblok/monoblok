---
name: qa-engineer-manual
description:
  Use when the user requests manual testing, QA, or reproduction of a bug report for a package
  against a real Storyblok space
---

# QA Engineer for Manual Testing

Focus on behavior that depends on the real Storyblok API; logic is already covered by automated
tests.

- Create and execute plans for manually testing and validating the requested feature.
- Seed Storyblok QA spaces with reproducible test scenarios.
- Reproduce and investigate bug reports.
- Provide thoughtful feedback regarding incomplete, broken, or missing features.
- Packages might define additional guidelines in `./packages/PACKAGE_NAME/test/GUIDE.md`.

## Preparation

1. Run `pnpm nx build PACKAGE_NAME` to build the latest version of the package(s).
2. Create a comprehensive test plan based on the assignment.
   - Focus on what's best tested manually, not on what automated tests already cover.
   - Test all happy paths.
   - Test error scenarios.
   - Consider possible edge cases.
3. If the feature holds state, keeps working after it has responded, or ships to more than one
   runtime, load `runtime-checklist.md`.
4. If the feature renders Storyblok content that an editor can change while the page is open, or
   registers the Storyblok Bridge, load `visual-editor-checklist.md`.

## Seeding

You seed Storyblok QA spaces with predefined test scenarios. Packages might define scenario data in
`./packages/PACKAGE_NAME/test/scenarios/`.

- **Every seed wipes the space first.** `seed-scenario.sh` runs `cleanup-remote.sh` before staging
  unless you pass `--no-clean`, so re-seeding deletes whatever the previous seed created. If data
  you seeded earlier looks like it vanished, suspect a later re-seed or a failed push, not the space
  resetting itself.
- **Trust the seed's exit status, not just its log.** The seed verifies each staged resource landed
  remotely and exits non-zero with `Verification FAILED` when a push reports success but creates
  nothing.
- **A green seed proves storage, not shape.** See the Management API rule in the root `AGENTS.md`.

### Grounding a shape

When you need to know what a field option or content value really looks like, work down this list
and stop at the first step that answers it:

1. **Existing seeds.** Check the scenario fixtures for a field or value of that type. The corpus is
   kept aligned with real wire formats, so a shape already in there is usually your answer.
2. **Backend source**, when available. The truth for what is stored, normalized, and enforced,
   including schemas and error shapes.
3. **Editor source**, when available. The editor is what writes component schemas and content
   values.
4. **Ask the user to author it in the UI.** Last resort, when the source does not settle it. Ask
   them to create the field or story by hand in a QA space and give you the id, then read it back
   via MAPI (`curl` the component or story) and copy the result into the fixture verbatim. This is
   the only empirical evidence that exists - everything you push yourself is circular.

Never infer a shape from the schema form alone: the editor offers options it does not write, and
spaces hold keys the editor no longer offers.

### Prerequisites

- Run all scripts from the repo root: they read `./.env.qa-engineer-manual` and `cleanup-local.sh`
  deletes `./.storyblok/` relative to the working directory.
- `.env.qa-engineer-manual` in the repo root, created from `.env.qa-engineer-manual.template`.
  `STORYBLOK_TOKEN` and `STORYBLOK_SPACE_ID` are required.
- Storyblok CLI built: `pnpm nx build storyblok`. The seed runs `packages/cli/dist/index.mjs` and
  stages into `.storyblok/` under `git rev-parse --show-toplevel`, so in a worktree it uses that
  worktree's build and fails if it is not built.

`seed-scenario.sh` logs the CLI in for you. When you drive the CLI **directly** (e.g. running
`schema init`/`push` against the space without seeding), log in first with the same token — the CLI
reads its session from `storyblok login`, not from the env vars:

```bash
set -a && source ./.env.qa-engineer-manual && set +a
node ./packages/cli/dist/index.mjs login --token "$STORYBLOK_TOKEN" --region eu
```

### Built-in scenarios

| Scenario                 | Use when                                                                           | Space state after seed                           |
| ------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------ |
| `has-default-components` | Never manually — pushed automatically as a dependency before every scenario        | 4 components (page, blog, hero, cta)             |
| `has-stories`            | Testing pull/push with realistic cross-references, asset references, nested blocks | 4 components, 10 stories, 2 assets, 1 datasource |
| `has-many-stories`       | Load/bulk testing with many stories                                                | 4 components, 150 stories                        |
| `has-many-assets`        | Load/bulk testing with many assets                                                 | 4 components, 150 assets                         |

### Seed a scenario

```bash
bash .agents/skills/qa-engineer-manual/scripts/seed-scenario.sh \
  --scenario has-stories
```

The space defaults to `STORYBLOK_SPACE_ID`. `--space` accepts an ID or the name of an env var from
`.env.qa-engineer-manual` (e.g. `--space STORYBLOK_SPACE_ID_TARGET`).

Packages might define their own scenarios in `./packages/PACKAGE_NAME/test/scenarios`. You can find
additional information about these scenarios in
`./packages/PACKAGE_NAME/test/scenarios/SCENARIOS.md`.

### Seed an external scenario (`--scenario-dir`)

Use `--scenario-dir` to point at a scenarios directory outside of qa-engineer-manual — for example,
scenarios defined by a package in its `./test/scenarios` directory.

```bash
bash .agents/skills/qa-engineer-manual/scripts/seed-scenario.sh \
  --scenario has-rich-content \
  --scenario-dir packages/migrations/test/scenarios
```

External scenarios follow the same structure as built-in ones. Default components from
qa-engineer-manual are always staged first, then scenario-local components (if any) override/extend
them.

### Skip specific resource types

```bash
bash .agents/skills/qa-engineer-manual/scripts/seed-scenario.sh \
  --scenario has-stories \
  --skip-datasources
```

Flags: `--skip-components`, `--skip-datasources`, `--skip-assets`, `--skip-stories`

### Seed without cleaning (`--no-clean`)

Use `--no-clean` to push additively, e.g. to layer multiple scenarios.

```bash
bash .agents/skills/qa-engineer-manual/scripts/seed-scenario.sh \
  --scenario has-stories

# Later, add more data without wiping:
bash .agents/skills/qa-engineer-manual/scripts/seed-scenario.sh \
  --scenario has-many-assets --no-clean --skip-components
```

### Clean up a space

```bash
bash .agents/skills/qa-engineer-manual/scripts/cleanup-remote.sh
```

Deletes all stories, components (except `page`), component folders, assets, asset folders, internal
tags, and datasources in the space.

### Shared asset libraries

Shared (org-level) asset libraries are global: they belong to the organization and can be shared
across spaces, so a full wipe is destructive. Cleanup is scoped by folder membership, not by name.
`--shared --library <libraryId>` deletes every shared asset in the library's folder tree, every
internal tag scoped to the library, and every child folder. It never deletes the library root folder
or any resource outside the given library. Folder scoping is deliberate: transferred assets keep
their original names, so a `qa-` name prefix would miss them.

Because this removes all content inside the library regardless of name, only run it against a
dedicated QA library, never a shared library that holds real org content.

```bash
bash .agents/skills/qa-engineer-manual/scripts/cleanup-remote.sh --shared --library <libraryId>
```

Inspect a library first with `list.sh --resource shared-assets|shared-folders|shared-tags`. Package
guides (for example `packages/cli/test/GUIDE.md`) describe the CLI push/pull workflow against
libraries.

`list.sh --resource shared-folders` only shows libraries the given `--space` already has access to;
an empty result doesn't mean none exists. Check the org endpoint instead:
`curl https://mapi.storyblok.com/v1/orgs/<orgId>/shared_asset_folders -H "Authorization: $STORYBLOK_TOKEN"`.
To grant your QA space access, `PUT` to that same endpoint with `asset_folder_access` — it replaces
the whole list, so include existing entries too or you'll revoke them.

Before reusing a library, list its contents
(`list.sh --resource shared-assets --library <libraryId>`). If it looks like production data, stop
and tell the user instead of writing to or cleaning it. If it looks like test fixtures, it's fine to
use.

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

- **Components**: Always merged with qa-engineer-manual's `has-default-components` (page, blog,
  hero, cta). Scenario-local components override defaults with the same filename.
- **generate.sh**: If present, runs instead of copying static files. Receives `staging_dir` and
  `fake_id` as arguments.
- **All component JSON files** must include `"component_group_uuid": null` to satisfy the CLI's
  `findComponentSchemas` check.

## Perform tests

**Tests MUST run sequentially, one at a time.** Many tests depend on a specific scenario being
seeded in the QA space. Running tests in parallel causes race conditions where one test re-seeds the
space while another is mid-flight, leading to false failures. Execute each test group fully before
moving to the next.

- Clean up local artifacts with `cleanup-local.sh`. Don't hesitate to clean up between tests to
  start with a clean slate.
- Place test scripts in `./.claude/tmp/`. Import from the built package:
  `../../packages/PACKAGE_NAME/dist/index.mjs`.
- Export env vars before running:
  `set -a && source ./.env.qa-engineer-manual && set +a && node ./.claude/tmp/test-name.mjs`.
- The stories `cdn/links` endpoint does NOT return `content` — `story.content?.component` will be
  `undefined` in `cdn/links` responses. Fetch individual stories for full content.
- When using two spaces (for example, mapping references between source and target), use
  `STORYBLOK_SPACE_ID_TARGET` for the target (loaded via `.env.qa-engineer-manual`).

## Helper scripts

Scripts live in `.agents/skills/qa-engineer-manual/scripts/`; run them from the repo root. Scripts
that call the API load `.env.qa-engineer-manual` themselves.

| Script                       | Purpose                                                                                                                                                                                                                                                                                                                     |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cleanup-local.sh`           | Deletes local QA artifacts in `.storyblok/`.                                                                                                                                                                                                                                                                                |
| `cleanup-remote.sh`          | Deletes all stories, components (except `page`), component folders, assets, asset folders, internal tags, and datasources in the space. Accepts `--space <id>`. Add `--shared --library <id>` to instead delete all shared resources in the given org library's folder tree, never the root (see "Shared asset libraries"). |
| `list.sh`                    | Lists resources in the QA space. Pass `--resource stories\|assets\|components\|datasources` and optionally `--space <id>`. For org libraries: `--resource shared-assets\|shared-tags --library <id>` or `--resource shared-folders`.                                                                                        |
| `save-storyblok-session.mjs` | Opens a headed browser so you can log in to app.storyblok.com once; saves the session to `.storyblok-qa/session.json` for Playwright harnesses and one-off scripts to reuse. Run with `node`, no env needed. Never reads or stores a credential.                                                                            |
| `configure-space.sh`         | Reads a space's Visual Editor preview domain, and sets it with `--domain <https-url> --confirm`. Read-only without `--confirm`; refuses non-https domains. Accepts `--space <id>`.                                                                                                                                          |
| `generate-story.sh`          | Writes a story JSON to stdout. All fields optional — use flags to override `--slug`, `--full-slug`, `--name`, `--component`, `--parent-id`, `--is-folder`, `--id`, `--uuid`.                                                                                                                                                |
| `generate-asset.sh`          | Writes an asset sidecar JSON to stdout. Use `--id`, `--filename`, `--alt`, `--title`, `--is-private`, `--folder-id`. Pass `--copy-png <path>` to also copy the template PNG to a target path.                                                                                                                               |

## Troubleshooting

- Load the variables listed in `.env.qa-engineer-manual.template` with
  `source ./.env.qa-engineer-manual` (do not attempt to read this file).
- When running `.mjs` test files, env vars must be **exported**
  (`set -a && source ./.env.qa-engineer-manual && set +a`) — plain `source` does not propagate to
  `node` subprocesses.

**MAPI:**

- **Auth uses `personalAccessToken`** — The MAPI client config property is `personalAccessToken` (or
  `oauthToken` for OAuth).
  ```js
  createManagementApiClient({ personalAccessToken: process.env.STORYBLOK_TOKEN, spaceId });
  ```
- **Assets list does NOT support `sort_by`** — passing `sort_by: 'id:asc'` returns HTTP 422 and
  `data: undefined`.

**CLI:**

- **`--asset-token` requires an `asset`-type API key** — Only a token with access type `asset`
  works. Use `STORYBLOK_ASSET_TOKEN` or `STORYBLOK_ASSET_TOKEN_TARGET` environment variables.

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
