---
name: Test Plan Example
description: Example of a detailed test plan for a CLI feature
---

# Assets Push and Pull Manual Test Plan

## Environment setup

```bash
cd ./packages/cli
./.claude/skills/qa-engineer-manual/scripts/cleanup-remote.sh
./.claude/skills/qa-engineer-manual/scripts/cleanup-local.sh
pnpm nx build storyblok
source ./.env.qa
./dist/index.mjs logout && ./dist/index.mjs login --token "$STORYBLOK_TOKEN" --region eu
```

## Test cases

### 1. Pull command tests

#### 1.1 Basic pull

```bash
./.claude/skills/qa-engineer-manual/scripts/asset-create.sh
./dist/index.mjs assets pull --space $STORYBLOK_SPACE_ID
```

**Verify:**

- [ ] Assets downloaded to `.storyblok/assets/$STORYBLOK_SPACE_ID/`.
- [ ] Each asset has both a binary file and a `.json` metadata file.
- [ ] Folders exist in `.storyblok/assets/$STORYBLOK_SPACE_ID/folders/`.
- [ ] Report generated in `.storyblok/reports/$STORYBLOK_SPACE_ID/`.

#### 1.2 Pull with query filter

```bash
./dist/index.mjs assets pull --space $STORYBLOK_SPACE_ID --query "in_folder=-1"
./dist/index.mjs assets pull --space $STORYBLOK_SPACE_ID --query "search=hero"
```

**Verify:**

- [ ] Only matching assets are downloaded.

#### 1.3 Pull dry run

```bash
./dist/index.mjs assets pull --space $STORYBLOK_SPACE_ID --dry-run
```

**Verify:**

- [ ] No files created.
- [ ] Summary shows what would be pulled.

### 2. Push command tests (bulk)

#### 2.1 Push to different space (migration)

```bash
./.claude/skills/qa-engineer-manual/scenarios/has-nested-asset-folders.sh
./dist/index.mjs assets pull --space $STORYBLOK_SPACE_ID
./dist/index.mjs assets push --space $STORYBLOK_SPACE_ID_TARGET --from $STORYBLOK_SPACE_ID
```

**Verify:**

- [ ] Assets created in target space.
- [ ] Manifest file created with old_id -> new_id mappings.
- [ ] Folder structure preserved.

#### 2.2 Resume failed push

```bash
# Start push, interrupt with Ctrl+C, then resume:
./dist/index.mjs assets push --space $STORYBLOK_SPACE_ID_TARGET --from $STORYBLOK_SPACE_ID
```

**Verify:**

- [ ] Already-pushed assets updated (not duplicated).
- [ ] Remaining assets created.

### 3. Push command tests (single asset)

#### 3.1 Push local file with sidecar JSON

```bash
./.claude/skills/qa-engineer-manual/scripts/png-create.sh ./\.claude/tmp/local-asset.png
echo '{"meta_data":{"alt":"Test Alt"}}' > ./.claude/tmp/local-asset.json
./dist/index.mjs assets push --space $STORYBLOK_SPACE_ID_TARGET ./.claude/tmp/local-asset.png
```

**Verify:**

- [ ] Asset created with metadata from sidecar JSON.

#### 3.2 Push external URL

```bash
./dist/index.mjs assets push --space $STORYBLOK_SPACE_ID_TARGET "https://picsum.photos/id/1/800/600.jpg"
```

**Verify:**

- [ ] Asset downloaded and uploaded to Storyblok.
- [ ] Filename inferred from URL.

### 4. Error handling

#### 4.1 Invalid space ID

```bash
./dist/index.mjs assets pull --space 99999999
```

**Verify:**

- [ ] Clear error message about authentication or space access.

#### 4.2 Invalid asset path

```bash
./dist/index.mjs assets push --space $STORYBLOK_SPACE_ID_TARGET ./nonexistent/file.png
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
