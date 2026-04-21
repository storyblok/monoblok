# ADR-0003: Remove Change Detection from `assets push`

**Status:** Accepted  
**Date:** 2026-04-15

## Context

The `storyblok assets push` command performed change detection before uploading each asset: it fetched the remote asset's metadata, downloaded the full remote binary, computed SHA-256 hashes of both local and remote files, and compared metadata fields. Only when a difference was detected would it proceed with the upload.

While this avoided unnecessary uploads, it introduced significant bandwidth overhead. Pushing a single 5 MB asset required downloading the same 5 MB file just to compare hashes — doubling the minimum bandwidth to 10 MB even when the asset had changed and needed uploading anyway. At scale, this overhead compounds.

Investigation confirmed that re-uploading an asset preserves its URL, so there is no risk of orphaned URLs in stories.

## Decision

Remove all change detection from `assets push`. Every invocation unconditionally uploads all assets it encounters — creating new assets or replacing existing ones — without downloading or comparing remote content.

This also removes the `--asset-token` CLI option from the push command, which was only needed to download private assets for comparison.

## Alternatives Considered

- **Metadata-only comparison** — Compare only the lightweight GET response (no binary download). Rejected because it cannot detect binary-only changes (e.g. a resized image with identical metadata), making the detection unreliable.
- **Manifest-cached SHA-256 hashes** — Store the hash of each pushed file in the manifest and compare on subsequent pushes. Rejected because it cannot detect changes made through the Storyblok UI (the user may edit an asset via the editor without re-pulling), leading to stale hashes and missed updates.

## Consequences

- Simpler implementation with fewer network calls per asset (no GET + download for comparison).
- Every push re-uploads all targeted assets regardless of whether they changed. Users who want selective uploads must manage that externally (e.g. by only placing changed files in the assets directory).
- The `--asset-token` option is no longer available on push (it remains available on pull where it is needed to download private assets).
