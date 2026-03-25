import * as assetsApi from '../generated/assets/sdk.gen';
import type {
  Asset,
  AssetSignRequest,
  AssetUpdate,
  BulkMoveData,
  BulkMoveResponses,
  BulkRestoreData,
  BulkRestoreResponses,
  FinalizeResponses,
  GetResponses,
  ListData,
  ListResponses,
  RemoveManyData,
  RemoveManyResponses,
  RemoveResponses,
  SignResponseObjectData,
  SignResponseObjectResponses,
  UpdateData,
  UpdateResponses,
} from '../generated/assets/types.gen';
import type { ApiResponse, FetchOptions, MapiResourceDeps } from '../index';
import { resolveSpaceId, type SpaceIdPathOverride } from './shared';

/**
 * Fields for initiating an asset upload. Pass this to `upload()`, `create()`,
 * or `update()` alongside a file buffer.
 *
 * Uses `short_filename` (e.g. `"hero.png"`) to clearly distinguish it from
 * `Asset.filename`, which is the full CDN URL assigned by Storyblok after upload.
 *
 * If you need to call the raw sign endpoint directly, use
 * `signResponseObject()` with `AssetSignRequest` instead.
 */
export interface AssetUploadRequest {
  /** The desired filename for the asset (e.g. `"hero.png"`). Corresponds to `Asset.short_filename`. */
  short_filename: string;
  /** When set, the upload replaces the file of an existing asset with this ID. */
  id?: AssetSignRequest['id'];
  /** Place the asset in this folder. */
  asset_folder_id?: AssetSignRequest['asset_folder_id'];
  /** Mark the asset as private (inaccessible without a signed URL). */
  is_private?: AssetSignRequest['is_private'];
  /** Image dimensions in `"<width>x<height>"` format (e.g. `"400x500"`). */
  size?: AssetSignRequest['size'];
  /** Set to `1` to enable server-side upload validation. */
  validate_upload?: AssetSignRequest['validate_upload'];
}

/**
 * Input for `create()`. Combines upload fields (`short_filename`,
 * `asset_folder_id`, etc.) with writable metadata (`alt`, `title`,
 * `copyright`, etc.). The file buffer is passed separately.
 */
export type AssetCreate = AssetUpdate & AssetUploadRequest;

/** Uploads the file to S3 using the signed fields from step 1. */
async function uploadToS3(
  signedResponse: SignResponseObjectResponses[200],
  file: Blob | ArrayBuffer,
  filename: string,
): Promise<void> {
  if (!signedResponse.post_url || !signedResponse.fields) {
    throw new Error('Invalid signed response: missing post_url or fields');
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
    throw new Error(`Failed to upload asset to S3: ${response.statusText}`);
  }
}

export function createAssetsResource(deps: MapiResourceDeps) {
  const { client, spaceId, wrapRequest } = deps;
  const getSpaceId = (path?: SpaceIdPathOverride['path']) => resolveSpaceId(spaceId, path);

  return {
    list<ThrowOnError extends boolean = false>(options: { query?: ListData['query']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<ListResponses[200], ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<ListResponses[200], ThrowOnError>(() =>
        assetsApi.list({ client, path: { space_id: resolvedSpaceId }, query, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    /**
     * Requests a signed response object (step 1 of the upload flow).
     * Returns the S3 `post_url` and form `fields` needed for the actual upload.
     *
     * In most cases, prefer `upload()` or `create()` which handle all three
     * steps automatically.
     */
    signResponseObject<ThrowOnError extends boolean = false>(options: { body: SignResponseObjectData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<ApiResponse<SignResponseObjectResponses[200], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<SignResponseObjectResponses[200], ThrowOnError>(() =>
        assetsApi.signResponseObject({ client, path: { space_id: resolvedSpaceId }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    /**
     * Uploads a file to Storyblok (sign → S3 upload → finalize) and returns
     * the resulting `Asset`.
     *
     * To also set metadata (alt, title, etc.) in one call, use `create()`.
     */
    async upload(options: { body: AssetUploadRequest; file: Blob | ArrayBuffer; signal?: AbortSignal; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<Asset> {
      const { body, file, signal, path, fetchOptions } = options;
      const { short_filename, ...rest } = body;
      const signBody: AssetSignRequest = { filename: short_filename, ...rest };
      const resolvedSpaceId = getSpaceId(path);
      const kyOpts = fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {};

      const signResult = await wrapRequest<SignResponseObjectResponses[200], true>(() =>
        assetsApi.signResponseObject({ client, path: { space_id: resolvedSpaceId }, body: signBody, signal, throwOnError: true, ...kyOpts }), true);

      if (!signResult.data.id) {
        throw new Error('Invalid signed response: missing id');
      }

      await uploadToS3(signResult.data, file, short_filename);

      await wrapRequest<FinalizeResponses[200], true>(() =>
        assetsApi.finalize({
          client,
          path: { space_id: resolvedSpaceId, signed_response_object_id: String(signResult.data.id) },
          signal,
          throwOnError: true,
          ...kyOpts,
        }), true);

      const getResult = await wrapRequest<GetResponses[200], true>(() =>
        assetsApi.get({ client, path: { space_id: resolvedSpaceId, asset_id: Number(signResult.data.id) }, signal, throwOnError: true, ...kyOpts }), true);

      return getResult.data;
    },
    /**
     * Creates a new asset with metadata. Performs the full upload flow, then
     * applies any provided metadata (alt, title, copyright, etc.) in a
     * follow-up update call. Returns the resulting `Asset`.
     */
    async create(options: { body: AssetCreate; file: Blob | ArrayBuffer; signal?: AbortSignal; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<Asset> {
      const { body, file, signal, path, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      const kyOpts = fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {};

      const asset = await this.upload({
        body: {
          short_filename: body.short_filename,
          asset_folder_id: body.asset_folder_id,
          is_private: body.is_private,
        },
        file,
        signal,
        path: { space_id: resolvedSpaceId },
        fetchOptions,
      });

      const { short_filename, asset_folder_id, is_private, size, validate_upload, ...metadata } = body;
      const hasMetadata = Object.values(metadata).some(v => v !== undefined && v !== null);
      if (hasMetadata) {
        await wrapRequest<UpdateResponses[204], true>(() =>
          assetsApi.update({
            client,
            path: { space_id: resolvedSpaceId, asset_id: asset.id },
            body: { asset: metadata },
            signal,
            throwOnError: true,
            ...kyOpts,
          }), true);
        const updatedResult = await wrapRequest<GetResponses[200], true>(() =>
          assetsApi.get({ client, path: { space_id: resolvedSpaceId, asset_id: asset.id }, signal, throwOnError: true, ...kyOpts }), true);
        return updatedResult.data;
      }

      return asset;
    },
    get<ThrowOnError extends boolean = false>(assetId: number | string, options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<GetResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<GetResponses[200], ThrowOnError>(() =>
        assetsApi.get({ client, path: { space_id: resolvedSpaceId, asset_id: assetId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    /**
     * Updates an asset's metadata. When `file` and `short_filename` are
     * provided, the file is replaced first (sign → S3 → finalize), then
     * metadata is updated.
     */
    async update(
      assetId: number | string,
      options: (
        | { body: UpdateData['body']; file?: undefined }
        | { body: UpdateData['body'] & { short_filename: string }; file: Blob | ArrayBuffer }
      ) & { signal?: AbortSignal; fetchOptions?: FetchOptions } & SpaceIdPathOverride,
    ): Promise<void> {
      const { body, file, signal, path, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      const kyOpts = fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {};

      if (file !== undefined) {
        const { short_filename, ...assetBody } = body;
        const signResult = await wrapRequest<SignResponseObjectResponses[200], true>(() =>
          assetsApi.signResponseObject({
            client,
            path: { space_id: resolvedSpaceId },
            body: { filename: short_filename, id: Number(assetId) },
            signal,
            throwOnError: true,
            ...kyOpts,
          }), true);

        if (!signResult.data.id) {
          throw new Error('Invalid signed response: missing id');
        }

        await uploadToS3(signResult.data, file, short_filename);

        await wrapRequest<FinalizeResponses[200], true>(() =>
          assetsApi.finalize({
            client,
            path: { space_id: resolvedSpaceId, signed_response_object_id: String(signResult.data.id) },
            signal,
            throwOnError: true,
            ...kyOpts,
          }), true);

        if (assetBody.asset && Object.keys(assetBody.asset).length > 0) {
          await wrapRequest<UpdateResponses[204], true>(() =>
            assetsApi.update({ client, path: { space_id: resolvedSpaceId, asset_id: assetId }, body: assetBody, signal, throwOnError: true, ...kyOpts }), true);
        }
      }
      else {
        await wrapRequest<UpdateResponses[204], true>(() =>
          assetsApi.update({ client, path: { space_id: resolvedSpaceId, asset_id: assetId }, body, signal, throwOnError: true, ...kyOpts }), true);
      }
    },
    remove<ThrowOnError extends boolean = false>(assetId: number | string, options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<RemoveResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<RemoveResponses[200], ThrowOnError>(() =>
        assetsApi.remove({ client, path: { space_id: resolvedSpaceId, asset_id: assetId }, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    finalize<ThrowOnError extends boolean = false>(signedResponseObjectId: string, options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<FinalizeResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<FinalizeResponses[200], ThrowOnError>(() =>
        assetsApi.finalize({
          client,
          path: { space_id: resolvedSpaceId, signed_response_object_id: signedResponseObjectId },
          signal,
          ...(throwOnError === undefined ? {} : { throwOnError }),
          ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}),
        }), throwOnError);
    },
    removeMany<ThrowOnError extends boolean = false>(options: { body: RemoveManyData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<ApiResponse<RemoveManyResponses[200], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<RemoveManyResponses[200], ThrowOnError>(() =>
        assetsApi.removeMany({ client, path: { space_id: resolvedSpaceId }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    bulkMove<ThrowOnError extends boolean = false>(options: { body: BulkMoveData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<ApiResponse<BulkMoveResponses[200], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<BulkMoveResponses[200], ThrowOnError>(() =>
        assetsApi.bulkMove({ client, path: { space_id: resolvedSpaceId }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
    bulkRestore<ThrowOnError extends boolean = false>(options: { body: BulkRestoreData['body']; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<ApiResponse<BulkRestoreResponses[200], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<BulkRestoreResponses[200], ThrowOnError>(() =>
        assetsApi.bulkRestore({ client, path: { space_id: resolvedSpaceId }, body, signal, ...(throwOnError === undefined ? {} : { throwOnError }), ...(fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {}) }), throwOnError);
    },
  };
}
