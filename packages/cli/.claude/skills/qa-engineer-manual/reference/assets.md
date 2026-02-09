# Work With Assets

## Prerequisites

Load the QA environment variables before running the commands.

```bash
source ./.env.qa
```

## Create an asset

The `asset-create.sh` script creates a placeholder asset. It downloads a placeholder image, requests a signed upload, uploads it, and finalizes the asset.

```bash
./.claude/skills/qa-engineer-manual/scripts/asset-create.sh
./.claude/skills/qa-engineer-manual/scripts/asset-create.sh 1200x800 custom-placeholder.png
```

## List assets

The `asset-list.sh` script lists all assets in the space.

```bash
./.claude/skills/qa-engineer-manual/scripts/asset-list.sh
```

## Create asset folders

The `asset-folder-create.sh` script creates an asset folder with an optional parent ID.

```bash
./.claude/skills/qa-engineer-manual/scripts/asset-folder-create.sh "My Folder"
./.claude/skills/qa-engineer-manual/scripts/asset-folder-create.sh "Nested Folder" 123
```

## List asset folders

The `asset-folder-list.sh` script lists all asset folders in the space.

```bash
./.claude/skills/qa-engineer-manual/scripts/asset-folder-list.sh
```

## Update asset folders

The `asset-folder-update.sh` script updates an asset folder name or parent ID.

```bash
./.claude/skills/qa-engineer-manual/scripts/asset-folder-update.sh 456 "Updated Name"
./.claude/skills/qa-engineer-manual/scripts/asset-folder-update.sh 456 "Updated Name" 789
```

## Generate local PNG files

The `png-create.sh` script generates a tiny local PNG for testing uploads.

```bash
./.claude/skills/qa-engineer-manual/scripts/png-create.sh
./.claude/skills/qa-engineer-manual/scripts/png-create.sh 100x50
```
