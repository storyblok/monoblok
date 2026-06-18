import * as mapi from '../generated/mapi/sdk.gen';
import type {
  BulkDestroyAssetsData,
  BulkDestroyAssetsResponses,
  BulkRestoreAssetsData,
  BulkRestoreAssetsResponses,
  BulkUpdateAssetsData,
  BulkUpdateAssetsResponses,
  CreateAssetData,
  CreateAssetResponses,
  DeleteAssetResponses,
  FinishAssetUploadResponses,
  GetAssetResponses,
  ListAssetsData,
  ListAssetsResponses,
  UpdateAssetData,
  UpdateAssetResponses,
} from '../generated/mapi/types.gen';
import type { Asset } from '../generated/mapi/types-aliased.gen';
import type { ApiResponse, FetchOptions, MapiResourceDeps } from '../client';
import { ClientError } from '../error';
import { resolveSpaceId, type SpaceIdPathOverride } from './shared';

export type AssetListQuery = NonNullable<ListAssetsData['query']>;

/**
 * Return shape of `list()`.
 *
 * The list endpoint serializes rows with MAPI's `IndexAsset` serializer, which
 * is NOT identical to the `ShowAsset` (= `Asset`) shape returned by `get()`:
 * `IndexAsset` omits `file` and `permanently_deleted`. We deliberately surface
 * list rows as `Asset` so consumers work against a single asset type. The lie:
 * `file`/`permanently_deleted` are absent on list rows at runtime — consumers
 * needing those must re-fetch via `get()`.
 */
export type ListAssetsResult = Omit<ListAssetsResponses[200], 'assets'> & { assets: Array<Asset> };

/**
 * Fields for initiating an asset upload. Pass this to `upload()` or `create()`
 * alongside a file buffer.
 */
export type AssetUploadRequest = {
  /** The desired filename for the asset (e.g. `"hero.png"`). */
  short_filename: string;
} & Partial<Omit<NonNullable<CreateAssetData['query']>, 'filename'>>;

/**
 * Input for `create()`. Combines upload fields with writable metadata.
 */
export type AssetCreate = AssetUploadRequest & NonNullable<UpdateAssetData['body']['asset']>;

/** Uploads the file to S3 using the signed fields from step 1. */
export async function uploadToS3(
  signedResponse: { post_url?: string; fields?: Record<string, unknown> },
  file: Blob | ArrayBuffer,
  filename: string,
): Promise<void> {
  if (!signedResponse.post_url || !signedResponse.fields) {
    throw new ClientError('Invalid signed response: missing post_url or fields', {
      status: 0,
      statusText: 'Invalid signed response',
      data: signedResponse,
    });
  }
  const formData = new FormData();
  for (const [key, value] of Object.entries(signedResponse.fields)) {
    formData.append(key, value as string);
  }
  const contentType = (signedResponse.fields['Content-Type'] as string | undefined) ?? 'application/octet-stream';
  const blob = file instanceof Blob ? file : new Blob([file], { type: contentType });
  formData.append('file', new File([blob], filename, { type: contentType }));
  const response = await fetch(signedResponse.post_url, { method: 'POST', body: formData });
  if (!response.ok) {
    throw new ClientError(`Failed to upload asset to S3: ${response.statusText}`, {
      status: response.status,
      statusText: response.statusText,
      data: undefined,
    });
  }
}

const hasDefinedFields = (value: Record<string, unknown> | undefined): boolean =>
  Object.values(value ?? {}).some(v => v !== undefined && v !== null);

export function createAssetsResource<DefaultThrowOnError extends boolean = false>(deps: MapiResourceDeps<DefaultThrowOnError>) {
  const { client, spaceId, wrapRequest } = deps;
  const getSpaceId = (path?: SpaceIdPathOverride['path']) => resolveSpaceId(spaceId, path);

  return {
    list<ThrowOnError extends boolean = DefaultThrowOnError>(options: { query?: ListAssetsData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<ListAssetsResult, ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      // `listAssets` returns `IndexAsset` rows; we present them as `Asset` (see `ListAssetsResult`).
      return wrapRequest<ListAssetsResult, ThrowOnError>(() =>
        mapi.listAssets({ client, path: { space_id: resolvedSpaceId }, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    /**
     * Step 1 of the upload flow: requests a signed S3 upload object from MAPI.
     * Returns the S3 `post_url` and form `fields` needed for the actual upload.
     *
     * In most cases, prefer `upload()` or `create()` which handle all three
     * steps automatically.
     */
    signResponseObject<ThrowOnError extends boolean = DefaultThrowOnError>(options: { query: CreateAssetData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<ApiResponse<CreateAssetResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<CreateAssetResponses[200], ThrowOnError>(() =>
        mapi.createAsset({ client, path: { space_id: resolvedSpaceId }, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    /**
     * Uploads a file to Storyblok (sign → S3 upload → finish) and returns the
     * resulting `Asset`.
     */
    async upload(options: { body: AssetUploadRequest; file: Blob | ArrayBuffer; signal?: AbortSignal; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<Asset> {
      const { body, file, signal, path, fetchOptions } = options;
      const { short_filename, ...rest } = body;
      const resolvedSpaceId = getSpaceId(path);
      const kyOpts = fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {};

      const signResult = await wrapRequest<CreateAssetResponses[200], true>(() =>
        mapi.createAsset({ client, path: { space_id: resolvedSpaceId }, query: { filename: short_filename, ...rest }, signal, throwOnError: true, ...kyOpts }), true);

      if (!signResult.data.id) {
        throw new Error('Invalid signed response: missing id');
      }

      await uploadToS3(signResult.data, file, short_filename);

      await wrapRequest<FinishAssetUploadResponses[200], true>(() =>
        mapi.finishAssetUpload({
          client,
          path: { space_id: resolvedSpaceId, id: Number(signResult.data.id) },
          signal,
          throwOnError: true,
          ...kyOpts,
        }), true);

      const getResult = await wrapRequest<GetAssetResponses[200], true>(() =>
        mapi.getAsset({ client, path: { space_id: resolvedSpaceId, id: Number(signResult.data.id) }, signal, throwOnError: true, ...kyOpts }), true);

      return getResult.data;
    },
    /**
     * Creates a new asset with metadata. Performs the full upload flow then
     * applies any provided metadata in a follow-up update call.
     */
    async create(options: { body: AssetCreate; file: Blob | ArrayBuffer; signal?: AbortSignal; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<Asset> {
      const { body, file, signal, path, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      const kyOpts = fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {};

      const { short_filename, asset_folder_id, is_private, size, validate_upload, ext_id, ...metadataOnly } = body;
      const asset = await this.upload({
        body: { short_filename, asset_folder_id, is_private, size, validate_upload, ext_id },
        file,
        signal,
        path: { space_id: resolvedSpaceId },
        fetchOptions,
      });

      const hasMetadata = Object.values(metadataOnly).some(v => v !== undefined && v !== null);
      if (hasMetadata) {
        await wrapRequest<UpdateAssetResponses[204], true>(() =>
          mapi.updateAsset({
            client,
            path: { space_id: resolvedSpaceId, id: asset.id! },
            body: { asset: metadataOnly },
            signal,
            throwOnError: true,
            ...kyOpts,
          }), true);
        const updatedResult = await wrapRequest<GetAssetResponses[200], true>(() =>
          mapi.getAsset({ client, path: { space_id: resolvedSpaceId, id: asset.id! }, signal, throwOnError: true, ...kyOpts }), true);
        return updatedResult.data;
      }

      return asset;
    },
    get<ThrowOnError extends boolean = DefaultThrowOnError>(assetId: number, options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<GetAssetResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<GetAssetResponses[200], ThrowOnError>(() =>
        mapi.getAsset({ client, path: { space_id: resolvedSpaceId, id: assetId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    /**
     * Updates an asset's metadata. When `file` and `body.short_filename` are
     * provided, the file is replaced first (sign → S3 → finish), then metadata
     * is updated.
     */
    async update(
      assetId: number,
      options: (
        | { body: UpdateAssetData['body']; file?: undefined }
        | { body: UpdateAssetData['body'] & { short_filename: string }; file: Blob | ArrayBuffer }
      ) & { signal?: AbortSignal; fetchOptions?: FetchOptions } & SpaceIdPathOverride,
    ): Promise<void> {
      const { body, file, signal, path, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      const kyOpts = fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {};

      if (file !== undefined) {
        const { short_filename, ...assetBody } = body;
        const signResult = await wrapRequest<CreateAssetResponses[200], true>(() =>
          mapi.createAsset({
            client,
            path: { space_id: resolvedSpaceId },
            query: { filename: short_filename },
            signal,
            throwOnError: true,
            ...kyOpts,
          }), true);

        if (!signResult.data.id) {
          throw new Error('Invalid signed response: missing id');
        }

        await uploadToS3(signResult.data, file, short_filename);

        await wrapRequest<FinishAssetUploadResponses[200], true>(() =>
          mapi.finishAssetUpload({
            client,
            path: { space_id: resolvedSpaceId, id: Number(signResult.data.id) },
            signal,
            throwOnError: true,
            ...kyOpts,
          }), true);

        if (hasDefinedFields(assetBody.asset)) {
          await wrapRequest<UpdateAssetResponses[204], true>(() =>
            mapi.updateAsset({ client, path: { space_id: resolvedSpaceId, id: assetId }, body: assetBody, signal, throwOnError: true, ...kyOpts }), true);
        }
      }
      else {
        await wrapRequest<UpdateAssetResponses[204], true>(() =>
          mapi.updateAsset({ client, path: { space_id: resolvedSpaceId, id: assetId }, body, signal, throwOnError: true, ...kyOpts }), true);
      }
    },
    delete<ThrowOnError extends boolean = DefaultThrowOnError>(assetId: number, options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<DeleteAssetResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<DeleteAssetResponses[200], ThrowOnError>(() =>
        mapi.deleteAsset({ client, path: { space_id: resolvedSpaceId, id: assetId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    finalize<ThrowOnError extends boolean = DefaultThrowOnError>(assetId: number, options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<FinishAssetUploadResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<FinishAssetUploadResponses[200], ThrowOnError>(() =>
        mapi.finishAssetUpload({
          client,
          path: { space_id: resolvedSpaceId, id: assetId },
          signal,
          ...(throwOnError === undefined ? {} : { throwOnError }),
          ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}),
        }), throwOnError);
    },
    /** POST /assets/bulk_destroy: hard-delete many assets in one call. */
    deleteMany<ThrowOnError extends boolean = DefaultThrowOnError>(options: { body: BulkDestroyAssetsData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<ApiResponse<BulkDestroyAssetsResponses[200], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<BulkDestroyAssetsResponses[200], ThrowOnError>(() =>
        mapi.bulkDestroyAssets({ client, path: { space_id: resolvedSpaceId }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    /** POST /assets/bulk_update: move many assets between folders in one call. */
    bulkMove<ThrowOnError extends boolean = DefaultThrowOnError>(options: { body: BulkUpdateAssetsData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<ApiResponse<BulkUpdateAssetsResponses[200], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<BulkUpdateAssetsResponses[200], ThrowOnError>(() =>
        mapi.bulkUpdateAssets({ client, path: { space_id: resolvedSpaceId }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    bulkRestore<ThrowOnError extends boolean = DefaultThrowOnError>(options: { body: BulkRestoreAssetsData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<ApiResponse<BulkRestoreAssetsResponses[200], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<BulkRestoreAssetsResponses[200], ThrowOnError>(() =>
        mapi.bulkRestoreAssets({ client, path: { space_id: resolvedSpaceId }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    /**
     * Converts a space-local asset into a shared (org-level) asset.
     *
     * Wraps `POST /v1/spaces/{space_id}/assets/{asset_id}/convert`, which takes
     * the destination folder as the required `target_asset_folder_id` query
     * param and no request body. One-way only (space to org).
     *
     * Not part of the generated SDK, so this issues a raw `client.post`.
     * The response is assumed to match `Asset`.
     */
    convertToShared<ThrowOnError extends boolean = false>(
      assetId: number | string,
      options: { query: { target_asset_folder_id: number }; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride,
    ): Promise<ApiResponse<Asset, ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<Asset, ThrowOnError>(() =>
        client.post({
          url: '/v1/spaces/{space_id}/assets/{asset_id}/convert',
          path: { space_id: resolvedSpaceId, asset_id: assetId },
          query,
          signal,
          ...(throwOnError === undefined ? {} : { throwOnError }),
          ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}),
        }), throwOnError);
    },
  };
}
