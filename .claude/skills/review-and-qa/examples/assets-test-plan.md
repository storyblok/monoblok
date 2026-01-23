---
name: Test Plan Example
description: Example of a detailed test plan for a CLI feature
---

# Assets Push and Pull Manual Test Plan

## Environment setup

```bash
# Perform all your tests within the CLI package.
cd ./packages/cli

# Clean up the local and remote QA environment.
./.claude/skills/qa-engineer-manual/scripts/cleanup-remote.sh
./.claude/skills/qa-engineer-manual/scripts/cleanup-local.sh

# Build the CLI.
pnpm nx build storyblok

# Log in with your OAuth token (Storyblok → My Account → Personal access tokens).
source ./.env.qa
./dist/index.mjs logout && ./dist/index.mjs login --token "$STORYBLOK_TOKEN" --region eu
```

## Test cases

### 1. Pull command tests

#### 1.1 Basic pull

```bash
# Seed assets for predictable results.
./.claude/skills/qa-engineer-manual/scripts/asset-create.sh
./.claude/skills/qa-engineer-manual/scripts/asset-create.sh 800x600 asset-pull-sample.png

./dist/index.mjs assets pull --space $STORYBLOK_SPACE_ID
```

**Verify:**

- [ ] Assets are downloaded to `.storyblok/assets/$STORYBLOK_SPACE_ID/`.
- [ ] Each asset has both a binary file and a `.json` metadata file.
- [ ] Folders exist in `.storyblok/assets/$STORYBLOK_SPACE_ID/folders/`.
- [ ] The CLI generates a report in `.storyblok/reports/$STORYBLOK_SPACE_ID/`.
- [ ] A log file exists.

#### 1.2 Pull with query filter

```bash
# Pull only assets in trash.
./dist/index.mjs assets pull --space $STORYBLOK_SPACE_ID --query "in_folder=-1"

# Pull assets matching a search term.
./dist/index.mjs assets pull --space $STORYBLOK_SPACE_ID --query "search=hero"

# Pull assets with specific tags.
./dist/index.mjs assets pull --space $STORYBLOK_SPACE_ID --query "with_tags=marketing"
```

**Verify:**

- [ ] The CLI only downloads matching assets.

#### 1.3 Pull with custom path

```bash
./dist/index.mjs assets pull --space $STORYBLOK_SPACE_ID --path ./custom-output
```

**Verify:**

- [ ] The CLI saves assets to `./custom-output/assets/$STORYBLOK_SPACE_ID/`.

#### 1.4 Pull dry run

```bash
./dist/index.mjs assets pull --space $STORYBLOK_SPACE_ID --dry-run
```

**Verify:**

- [ ] No files are created.
- [ ] The summary shows what would be pulled.

#### 1.5 Pull private assets

```bash
# Seed private assets for predictable results.
./.claude/skills/qa-engineer-manual/scenarios/has-private-assets.sh

./dist/index.mjs assets pull --space $STORYBLOK_SPACE_ID --query "is_private=1"
```

**Verify:**

- [ ] The CLI downloads private assets successfully.
- [ ] Binary content is valid (not an error page).

### 2. Push command tests (bulk)

#### 2.1 Push to same space (update)

```bash
# First pull assets.
./dist/index.mjs assets pull --space $STORYBLOK_SPACE_ID

# Modify a JSON metadata file (change alt text).
# Then push back.
./dist/index.mjs assets push --space $STORYBLOK_SPACE_ID
```

**Verify:**

- [ ] Assets are updated (not duplicated).

#### 2.2 Push to different space (migration)

```bash
# Seed assets and folders for predictable results.
./.claude/skills/qa-engineer-manual/scenarios/has-nested-asset-folders.sh

# Pull from source.
./dist/index.mjs assets pull --space $STORYBLOK_SPACE_ID

# Push to target with --from flag.
./dist/index.mjs assets push --space $STORYBLOK_SPACE_ID_TARGET --from $STORYBLOK_SPACE_ID
```

**Verify:**

- [ ] The CLI creates assets in target space.
- [ ] The CLI creates a manifest file with old_id -> new_id mappings.
- [ ] Folder structure is preserved in target space.
- [ ] Asset folder IDs are remapped correctly.

#### 2.3 Push with custom path

```bash
./dist/index.mjs assets push --space $STORYBLOK_SPACE_ID_TARGET --path ./custom-output --from $STORYBLOK_SPACE_ID
```

#### 2.4 Push dry run

```bash
./dist/index.mjs assets push --space $STORYBLOK_SPACE_ID_TARGET --from $STORYBLOK_SPACE_ID --dry-run
```

**Verify:**

- [ ] No assets are created in Storyblok.
- [ ] No manifest file is created.
- [ ] The summary shows what would happen.

#### 2.5 Resume failed push

```bash
# Start a push, interrupt it (Ctrl+C).
./dist/index.mjs assets push --space $STORYBLOK_SPACE_ID_TARGET --from $STORYBLOK_SPACE_ID

# Check manifest.jsonl for partial entries.
cat .storyblok/assets/$STORYBLOK_SPACE_ID_TARGET/manifest.jsonl

# Resume.
./dist/index.mjs assets push --space $STORYBLOK_SPACE_ID_TARGET --from $STORYBLOK_SPACE_ID
```

**Verify:**

- [ ] Already-pushed assets are updated (not duplicated).
- [ ] Remaining assets are created.
- [ ] The manifest contains all mappings.

### 3. Push command tests (single asset)

#### 3.1 Push local file

```bash
# Generate a local asset file in a temporary directory.
./.claude/skills/qa-engineer-manual/scripts/png-create.sh ./\.claude/tmp/local-asset.png

./dist/index.mjs assets push --space $STORYBLOK_SPACE_ID_TARGET ./.claude/tmp/local-asset.png
```

**Verify:**

- [ ] The CLI creates an asset in Storyblok.
- [ ] The filename is inferred from the local file.

#### 3.2 Push local file with sidecar JSON

```bash
# Create sidecar JSON with same basename.
echo '{"meta_data":{"alt":"Test Alt","title":"Test Title"}}' > ./.claude/tmp/local-asset.json

./dist/index.mjs assets push --space $STORYBLOK_SPACE_ID_TARGET ./.claude/tmp/local-asset.png
```

**Verify:**

- [ ] The CLI creates an asset with metadata from sidecar JSON.

#### 3.3 Push local file with inline data

```bash
./.claude/skills/qa-engineer-manual/scripts/png-create.sh ./\.claude/tmp/local-asset-inline.png

./dist/index.mjs assets push --space $STORYBLOK_SPACE_ID_TARGET ./.claude/tmp/local-asset-inline.png \
  --data '{"meta_data":{"alt":"Inline Alt","copyright":"2024"}}' \
  --short-filename "custom-name.png" \
  --folder 123
```

**Verify:**

- [ ] The CLI creates an asset with a custom filename.
- [ ] The asset is placed in the specified folder.
- [ ] Metadata is set correctly.

#### 3.4 Push external URL

```bash
./dist/index.mjs assets push --space $STORYBLOK_SPACE_ID_TARGET "https://picsum.photos/id/1/800/600.jpg"
```

**Verify:**

- [ ] The asset is downloaded and uploaded to Storyblok.
- [ ] The filename is inferred from the URL.

#### 3.5 Push external URL with cleanup

```bash
./dist/index.mjs assets push --space $STORYBLOK_SPACE_ID_TARGET "https://picsum.photos/id/2/800/600.jpg" --cleanup
```

**Verify:**

- [ ] The asset is uploaded.
- [ ] Temporary files are deleted after upload.

#### 3.6 Update existing asset

```bash
# Get an existing asset ID from your space.
./.claude/skills/qa-engineer-manual/scripts/asset-list.sh --space $STORYBLOK_SPACE_ID_TARGET

./dist/index.mjs assets push --space $STORYBLOK_SPACE_ID_TARGET ./.claude/tmp/local-asset.png \
  --data '{"id":EXISTING_ASSET_ID,"meta_data":{"alt":"Updated Alt"}}'
```

**Verify:**

- [ ] The asset is updated (same ID).
- [ ] Metadata is updated.
- [ ] The file is replaced if binary differs.

### 4. Story reference updates

#### 4.1 Update stories after single asset push

```bash
# Seed components and stories for predictable results.
./.claude/skills/qa-engineer-manual/scenarios/has-stories.sh --space $STORYBLOK_SPACE_ID_TARGET

# First, ensure you have pulled components.
./dist/index.mjs components pull --space $STORYBLOK_SPACE_ID_TARGET

# Push asset with --update-stories.
./dist/index.mjs assets push --space $STORYBLOK_SPACE_ID_TARGET ./test-assets/samples/image1.png \
  --data '{"id":EXISTING_ASSET_ID,"meta_data":{"alt":"New Alt"}}' \
  --update-stories
```

**Verify:**

- [ ] Stories referencing the asset are fetched.
- [ ] Asset references in stories are updated with the new ID and filename.
- [ ] Metadata in story asset fields is updated.

#### 4.2 Bulk migration with story updates

```bash
# Seed stories in the source space.
./.claude/skills/qa-engineer-manual/scenarios/has-stories.sh --space $STORYBLOK_SPACE_ID

# Pull everything from source.
./dist/index.mjs components pull --space $STORYBLOK_SPACE_ID
./dist/index.mjs assets pull --space $STORYBLOK_SPACE_ID
./dist/index.mjs stories pull --space $STORYBLOK_SPACE_ID

# Push assets to target (without --update-stories for efficiency).
./dist/index.mjs assets push --space $STORYBLOK_SPACE_ID_TARGET --from $STORYBLOK_SPACE_ID

# Push stories (which will use the asset manifest for reference mapping).
./dist/index.mjs stories push --space $STORYBLOK_SPACE_ID_TARGET --from $STORYBLOK_SPACE_ID
```

**Verify:**

- [ ] Assets are created in target with new IDs.
- [ ] Stories are created with asset references pointing to new asset IDs.

### 5. Folder handling

#### 5.1 Nested folder migration

```bash
# Seed nested folder structure in the source space.
./.claude/skills/qa-engineer-manual/scenarios/has-nested-asset-folders.sh

# Pull from source.
./dist/index.mjs assets pull --space $STORYBLOK_SPACE_ID

# Examine folder JSONs.
cat .storyblok/assets/$STORYBLOK_SPACE_ID/folders/*.json | jq

# Push to target.
./dist/index.mjs assets push --space $STORYBLOK_SPACE_ID_TARGET --from $STORYBLOK_SPACE_ID
```

**Verify:**

- [ ] Parent folders are created before children.
- [ ] Child folders have the correct parent_id in the target space.
- [ ] Assets are placed in the correct folders.

#### 5.2 Folder order test

```bash
# Check folder JSON filenames and their parent_id references.
ls -la .storyblok/assets/$STORYBLOK_SPACE_ID/folders/

# Verify order doesn't break parent references.
```

### 6. Error handling

#### 6.1 Invalid space ID

```bash
./dist/index.mjs assets pull --space 99999999
```

**Verify:**
- [ ] The CLI shows a clear error message about authentication or space access.

#### 6.2 Network failure during pull

```bash
# Disconnect network mid-pull or use a flaky connection.
./dist/index.mjs assets pull --space $STORYBLOK_SPACE_ID
```

**Verify:**

- [ ] Partial progress is saved.
- [ ] Clear error messages appear in the log.
- [ ] The CLI can resume after reconnecting.

#### 6.3 Invalid asset path

```bash
./dist/index.mjs assets push --space $STORYBLOK_SPACE_ID_TARGET ./nonexistent/file.png
```

**Verify:**

- [ ] The CLI shows a clear error about the file not being found.

#### 6.4 Invalid JSON data

```bash
./dist/index.mjs assets push --space $STORYBLOK_SPACE_ID_TARGET ./test-assets/samples/image1.png \
  --data '{invalid json}'
```

**Verify:**
- [ ] The CLI shows a clear error about JSON parsing.

### 7. Private assets

#### 7.1 Pull private assets

```bash
./.claude/skills/qa-engineer-manual/scenarios/has-private-assets.sh

./dist/index.mjs assets pull --space $STORYBLOK_SPACE_ID --query "is_private=1"
```

**Verify:**

- [ ] Private assets are downloaded successfully.
- [ ] JSON metadata shows `is_private: true`.

#### 7.2 Push private asset

```bash
# Create a JSON with is_private flag.
./.claude/skills/qa-engineer-manual/scripts/png-create.sh ./\.claude/tmp/private.png
echo '{"is_private":true,"meta_data":{"alt":"Private Asset"}}' > ./.claude/tmp/private.json

./dist/index.mjs assets push --space $STORYBLOK_SPACE_ID_TARGET ./.claude/tmp/private.png
```

**Verify:**

- [ ] The asset is created as private in Storyblok.
- [ ] The URL requires authentication to access.

### 8. Cleanup option

#### 8.1 Cleanup after successful push

```bash
# Create test files.
./.claude/skills/qa-engineer-manual/scripts/png-create.sh ./\.claude/tmp/cleanup-test.png
echo '{"meta_data":{"alt":"Cleanup Asset"}}' > ./.claude/tmp/cleanup-test.json

./dist/index.mjs assets push --space $STORYBLOK_SPACE_ID_TARGET ./.claude/tmp/cleanup-test.png --cleanup
```

**Verify:**

- [ ] The asset is uploaded successfully.
- [ ] The local file is deleted.
- [ ] The sidecar JSON is deleted (if it exists).

#### 8.2 No cleanup on failure

```bash
# Use invalid space to force failure.
./dist/index.mjs assets push --space 99999999 ./.claude/tmp/cleanup-test.png --cleanup
```

**Verify:**

- [ ] Upload fails.
- [ ] The local file is NOT deleted.

#### 8.3 Bulk push with cleanup

```bash
# Pull assets first.
./dist/index.mjs assets pull --space $STORYBLOK_SPACE_ID --path ./cleanup-bulk-test

# Push to target with cleanup.
./dist/index.mjs assets push --space $STORYBLOK_SPACE_ID_TARGET --from $STORYBLOK_SPACE_ID --path ./cleanup-bulk-test --cleanup
```

**Verify:**

- [ ] Assets are uploaded successfully.
- [ ] Local asset files are deleted after successful push.
- [ ] Local metadata JSON files are deleted.
- [ ] Folder JSON files are deleted.
- [ ] The manifest file is preserved (not deleted).

### 9. Edge cases

#### 9.1 Large file upload

```bash
# Test with a large file (>10MB).
./dist/index.mjs assets push --space $STORYBLOK_SPACE_ID_TARGET ./.claude/tmp/large-video.mp4
```

#### 9.2 Special characters in filename

```bash
./.claude/skills/qa-engineer-manual/scripts/png-create.sh "./\.claude/tmp/file with spaces & special (chars).png"

./dist/index.mjs assets push --space $STORYBLOK_SPACE_ID_TARGET "./.claude/tmp/file with spaces & special (chars).png"
```

#### 9.3 Very long filename

```bash
./.claude/skills/qa-engineer-manual/scripts/png-create.sh "./\.claude/tmp/$(printf 'a%.0s' {1..200}).png"

./dist/index.mjs assets push --space $STORYBLOK_SPACE_ID_TARGET "./.claude/tmp/$(printf 'a%.0s' {1..200}).png"
```

#### 9.4 Empty folder

```bash
# Create an empty assets directory.
mkdir -p .storyblok/assets/empty-test/
./dist/index.mjs assets push --space $STORYBLOK_SPACE_ID_TARGET --path ./empty-test
```

**Verify:**

- [ ] The CLI handles the empty directory gracefully.

## Checklist summary

### Pull command

- [ ] Basic pull works.
- [ ] Query filters work.
- [ ] Custom path works.
- [ ] Dry run works.
- [ ] Private assets work.
- [ ] Folders are pulled correctly.
- [ ] Reports and logs are generated.

### Push command (bulk)

- [ ] Same-space update works.
- [ ] Cross-space migration works.
- [ ] Manifest is created correctly.
- [ ] Folder remapping works.
- [ ] Resume from failure works.
- [ ] Dry run works.
- [ ] Cleanup works (deletes local files after push).

### Push command (single)

- [ ] Local file works.
- [ ] Sidecar JSON works.
- [ ] Inline data works.
- [ ] External URL works.
- [ ] Custom filename works.
- [ ] Folder assignment works.
- [ ] Update existing asset works.
- [ ] Cleanup works.

### Story updates

- [ ] Single asset update-stories works.
- [ ] Bulk migration with stories push works.

### Error handling

- [ ] Invalid inputs are handled gracefully.
- [ ] Network errors are reported clearly.
- [ ] Partial failures don't corrupt state.
