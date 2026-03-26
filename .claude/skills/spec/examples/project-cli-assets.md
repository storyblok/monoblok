# CLI Assets

## To find out

How to generate a map correctly when assets were not pulled by a Storyblok space? (fake temporary ids at mapping-phase? by path?)

## Context

This is about creating a higher level interface in the CLI over the raw MAPI Assets and Assets Folders to allow users to easily download and upload assets to Storyblok's DAM.

## Specifications

### General specs

As it's an implementation over the MAPI assets, it should cover and support the same characteristics as the MAPI: same types, mimetypes, etc -> https://www.storyblok.com/docs/concepts/assets

For the same reasons, it should attain to the rate limits and characteristics of the MAPI to consistently perform the operations without unwanted failures.

### Feature specs

Allows both public and private assets

Allows both single asset, or multiple assets in bulk, given an assets manifest

Allows both local assets (./path/my-image.png) and external url assets (https://domain.com/assets/my-image.png). In both cases, it should options available in the Assets MAPI endpoint:

- Destination folder (folder id)
- Size (wxh)
- Filename - by default, it's inferred from the filename of the asset, but this option can be used to override it.

For external url assets:

- It might require download them first temporarily - the downloaded asset should be deleted after successful upload
- It should allow to replace the old external url by the newly created asset object (with some sort of --apply-in-content option, as a separate command, or any other solution determined)

Allows to set asset data and metadata (should support all field in the Asset object). When no info is provided, filename fill be inferred automatically. Proposal (to be investigated further):

- Minimal asset info: `storyblok assets push -s <space-id> './my-image.jpg'` (will infer filename)
- Full asset info (via json object): `storyblok assets push -s <space-id> './my-image.jpg' --data='{"alt": "Alt", metadata:{"alt__i18n__de": "Alt in german"}}'` (part or full asset object is provided)

For bulk upload/download (more info below):

- It provides a DX and API aligned with other CLI commands, to filter, wildcard, and select the set of assets to be uploaded/downloaded.
- If no manifest.json is provided, assets will be uploaded with an inferred filename and using the folder structure as convention for folder path.
- Logging -> The bulk upload needs to generate a log as defined in CLI Logging system
- Mapping -> The build upload needs to generate a map of assets, for later being able to update references in Stories pushing CLI - Stories. Map should contain:

```json
{
  "<id>": {
    "newId": "<id>",
    "oldPath": "<path>",
    "oldFilename": "<filename>"
  }
}
```

### Filtering options

In both push/pull commands, users should be able to perform the operation on a subset of assets, according to the options allowed by the MAPI. Examples:

- Only assets in a specific folder: `in_folder={FOLDER_ID}`
- Only deleted assets (trash bin): `in_folder=-1`
- Only private assets: `is_private=1`
- Filename contains a keyword: `search=hero`
- Or a combination: `in_folder={FOLDER_ID}&search=hero`
- All private hero images for the 2025 campaign stored in the Campaign folder: `in_folder={CAMPAIGN_2025_FOLDER_ID}&search=hero-2025&is_private=1`

The filtering options API should be aligned with the rest of CLI's filtering DX in other commands

### Bulk upload/download

The CLI should allow downloading and uploading assets in bulk. In both cases, a folder structure and a manifest file to hold all asset info and metadata are needed.

A manifest file is a JSON file with a list of Asset objects, with some important differences:

- The filename property will be the path to the downloaded (or to-be-uploaded) local file. Example: `./assets/my-folder/my-image.jpg`

Two cases to cover:

**Case 1** - Uploading assets non-exported from a Storyblok space (e.g. exported from other CMSs): properties like asset_folder_id, internal_tag_ids are not relevant as that asset never existed in Storyblok.

**Case 2** - Uploading a set of assets previously downloaded from Storyblok: those properties are relevant as they set dependencies from the original space that need to be resolved in the destination space.

In any of both cases:

- A dependency graph might be needed to set the right asset to the right asset folder and keep references
- space_id is irrelevant, as it's set at command execution.

Manifest file example:

```json
[
  {
    "filename": "./assets/my-image.jpg",
    "is_private": true,
    "meta_data": {
      "alt": "Asset ALT",
      "title": "Asset Title",
      "copyright": "Custom Text"
    }
  }
]
```

Examples:

For downloading:

```bash
storyblok assets pull -s <space-id>
```

Should produce:

```
| - winter/
|    - swimming-in-ice.jpg
|    - docs/
|        - recap-of-my-trip.pdf
| - me.jpg
| - manifest.json
```

For uploading:

```bash
# single asset
storyblok assets push -s <space-id> "./winter/swimming-in-ice.jpg" --data "{...}"

# whole asset structure in bulk
storyblok assets push -s <space-id> --manifest "./manifest.json"
```

### Non-functional specs

- Error handling, informing the user of the asset upload/download status, is in place
