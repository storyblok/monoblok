---
name: Test Plan Example
description: Example of a detailed test plan for a CLI feature
---

# Assets Push and Pull Manual Test Plan

## Environment setup

Run everything from the repo root: the qa-engineer-manual scripts load `.env.qa-engineer-manual`
from the current working directory.

```bash
pnpm nx build storyblok
set -a && source ./.env.qa-engineer-manual && set +a
cli="node ./packages/cli/dist/index.mjs"

bash ./.agents/skills/qa-engineer-manual/scripts/cleanup-remote.sh
bash ./.agents/skills/qa-engineer-manual/scripts/cleanup-local.sh
$cli logout && $cli login --token "$STORYBLOK_TOKEN" --region eu
```

## Test cases

### 1. Pull command tests

#### 1.1 Basic pull

```bash
bash ./.agents/skills/qa-engineer-manual/scripts/seed-scenario.sh --scenario has-stories
$cli assets pull --space $STORYBLOK_SPACE_ID
```

**Verify:**

- [ ] Assets downloaded to `.storyblok/assets/$STORYBLOK_SPACE_ID/`.
- [ ] Each asset has both a binary file and a `.json` metadata file.
- [ ] Folders exist in `.storyblok/assets/$STORYBLOK_SPACE_ID/folders/`.
- [ ] Report generated in `.storyblok/reports/$STORYBLOK_SPACE_ID/`.

#### 1.2 Pull with query filter

```bash
$cli assets pull --space $STORYBLOK_SPACE_ID --query "in_folder=-1"
$cli assets pull --space $STORYBLOK_SPACE_ID --query "search=hero"
```

**Verify:**

- [ ] Only matching assets are downloaded.

#### 1.3 Pull dry run

```bash
$cli assets pull --space $STORYBLOK_SPACE_ID --dry-run
```

**Verify:**

- [ ] No files created.
- [ ] Summary shows what would be pulled.

### 2. Push command tests (bulk)

#### 2.1 Push to different space (migration)

```bash
bash ./.agents/skills/qa-engineer-manual/scripts/seed-scenario.sh \
  --scenario has-nested-asset-folders \
  --scenario-dir packages/cli/test/scenarios
$cli assets pull --space $STORYBLOK_SPACE_ID
$cli assets push --space $STORYBLOK_SPACE_ID_TARGET --from $STORYBLOK_SPACE_ID
```

**Verify:**

- [ ] Assets created in target space.
- [ ] Manifest file created with old_id -> new_id mappings.
- [ ] Folder structure preserved.

#### 2.2 Resume failed push

```bash
# Start push, interrupt with Ctrl+C, then resume:
$cli assets push --space $STORYBLOK_SPACE_ID_TARGET --from $STORYBLOK_SPACE_ID
```

**Verify:**

- [ ] Already-pushed assets updated (not duplicated).
- [ ] Remaining assets created.

### 3. Push command tests (single asset)

#### 3.1 Push local file with sidecar JSON

`generate-asset.sh` copies the template PNG to `--copy-png` and writes the sidecar JSON to stdout.

```bash
mkdir -p ./.claude/tmp
bash ./.agents/skills/qa-engineer-manual/scripts/generate-asset.sh \
  --filename "local-asset.png" --alt "Test Alt" \
  --copy-png ./.claude/tmp/local-asset.png > ./.claude/tmp/local-asset.json
$cli assets push --space $STORYBLOK_SPACE_ID_TARGET ./.claude/tmp/local-asset.png
```

**Verify:**

- [ ] Asset created with metadata from sidecar JSON.

#### 3.2 Push external URL

```bash
$cli assets push --space $STORYBLOK_SPACE_ID_TARGET "https://picsum.photos/id/1/800/600.jpg"
```

**Verify:**

- [ ] Asset downloaded and uploaded to Storyblok.
- [ ] Filename inferred from URL.

### 4. Error handling

#### 4.1 Invalid space ID

```bash
$cli assets pull --space 99999999
```

**Verify:**

- [ ] Clear error message about authentication or space access.

#### 4.2 Invalid asset path

```bash
$cli assets push --space $STORYBLOK_SPACE_ID_TARGET ./nonexistent/file.png
```

**Verify:**

- [ ] Clear error about file not found.

## Checklist summary

### Pull command

- [ ] Basic pull works.
- [ ] Query filters work.
- [ ] Dry run works.
- [ ] Reports and logs generated.

### Push command (bulk)

- [ ] Cross-space migration works.
- [ ] Manifest created correctly.
- [ ] Folder remapping works.
- [ ] Resume from failure works.

### Push command (single)

- [ ] Local file + sidecar JSON works.
- [ ] External URL works.
- [ ] Update existing asset works.

### Error handling

- [ ] Invalid inputs handled gracefully.
- [ ] Network errors reported clearly.
