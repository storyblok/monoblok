import * as mapi from '../generated/mapi/sdk.gen';
import type { CreateSpaceSharedAssetData, CreateSpaceSharedAssetResponses } from '../generated/mapi/types.gen';
import type { Asset, AssetUpdate } from '../generated/mapi/types-aliased.gen';
import type { ApiResponse, FetchOptions, MapiResourceDeps } from '../client';
import { uploadToS3 } from './assets';
import { resolveSpaceId, type SpaceIdPathOverride } from './shared';

/**
 * Fields for initiating a shared (org-level) asset upload. Mirrors the local
 * asset upload request; `short_filename` maps to the server's `filename`.
 */
export interface SharedAssetUploadRequest {
  short_filename: string;
  id?: number;
  asset_folder_id?: number;
  is_private?: boolean;
  size?: string;
  validate_upload?: boolean;
}

export type SharedAssetCreate = AssetUpdate & SharedAssetUploadRequest;

export interface SharedAssetListQuery {
  in_folder?: number;
  page?: number;
  per_page?: number;
  search?: string;
  sort_by?: string;
}

export interface SharedAssetListResponse {
  assets: Asset[];
}

/**
 * The generated `createSpaceSharedAsset` (sign) call's query type requires
 * `asset_folder_id`, and has no `id` field. In practice the endpoint also
 * accepts an `id` to re-sign an upload for an *existing* shared asset
 * (used by `update()` to replace a file in place), and tolerates
 * `asset_folder_id` being omitted in that case — neither is represented in
 * the OpenAPI spec. `SharedAssetUploadRequest` keeps both fields optional to
 * match this real, tested behavior.
 */
type SignSharedAssetQuery = NonNullable<CreateSpaceSharedAssetData['query']>;

/**
 * Shared (organization-level) assets. The active space must have read
 * (list/get) or write (create/update/delete) access to the library.
 */
export function createSharedAssetsResource<DefaultThrowOnError extends boolean = false>(deps: MapiResourceDeps<DefaultThrowOnError>) {
  const { client, spaceId, wrapRequest } = deps;
  const getSpaceId = (path?: SpaceIdPathOverride['path']) => resolveSpaceId(spaceId, path);
  const kyOpts = (fetchOptions?: FetchOptions) =>
    fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {};
  const maybeThrow = (throwOnError?: boolean) => (throwOnError === undefined ? {} : { throwOnError });

  return {
    list<ThrowOnError extends boolean = false>(options: { query?: SharedAssetListQuery; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<SharedAssetListResponse, ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      return wrapRequest<SharedAssetListResponse, ThrowOnError>(() =>
        mapi.listSpaceSharedAssets({ client, path: { space_id: getSpaceId(path) }, query: query && { ...query }, signal, ...maybeThrow(throwOnError), ...kyOpts(fetchOptions) }), throwOnError);
    },
    get<ThrowOnError extends boolean = false>(assetId: number | string, options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<Asset, ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      return wrapRequest<Asset, ThrowOnError>(() =>
        mapi.getSpaceSharedAsset({ client, path: { space_id: getSpaceId(path), id: Number(assetId) }, signal, ...maybeThrow(throwOnError), ...kyOpts(fetchOptions) }), throwOnError);
    },
    /** Uploads a file to a shared library (sign → S3 → finish_upload → get). */
    async upload(options: { body: SharedAssetUploadRequest; file: Blob | ArrayBuffer; signal?: AbortSignal; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<Asset> {
      const { body, file, signal, path, fetchOptions } = options;
      const { short_filename, ...rest } = body;
      const resolvedSpaceId = getSpaceId(path);
      const opts = kyOpts(fetchOptions);

      const signResult = await wrapRequest<CreateSpaceSharedAssetResponses[200], true>(() =>
        mapi.createSpaceSharedAsset({ client, path: { space_id: resolvedSpaceId }, query: { filename: short_filename, ...rest } as SignSharedAssetQuery, signal, throwOnError: true, ...opts }), true);
      if (!signResult.data.id) {
        throw new Error('Invalid signed response: missing id');
      }
      const assetId = signResult.data.id;

      await uploadToS3(signResult.data, file, short_filename);

      await wrapRequest<unknown, true>(() =>
        mapi.finishSpaceSharedAssetUpload({ client, path: { space_id: resolvedSpaceId, id: assetId }, signal, throwOnError: true, ...opts }), true);

      const getResult = await wrapRequest<Asset, true>(() =>
        mapi.getSpaceSharedAsset({ client, path: { space_id: resolvedSpaceId, id: assetId }, signal, throwOnError: true, ...opts }), true);
      return getResult.data;
    },
    /** Creates a shared asset (upload + metadata). Returns the resulting `Asset`. */
    async create(options: { body: SharedAssetCreate; file: Blob | ArrayBuffer; signal?: AbortSignal; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<Asset> {
      const { body, file, signal, path, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      const opts = kyOpts(fetchOptions);

      const asset = await this.upload({
        body: { short_filename: body.short_filename, asset_folder_id: body.asset_folder_id, is_private: body.is_private },
        file,
        signal,
        path: { space_id: resolvedSpaceId },
        fetchOptions,
      });

      const { short_filename, asset_folder_id, is_private, size, validate_upload, ...metadata } = body;
      const hasMetadata = Object.values(metadata).some(v => v !== undefined && v !== null);
      if (hasMetadata) {
        await wrapRequest<void, true>(() =>
          mapi.updateSpaceSharedAsset({ client, path: { space_id: resolvedSpaceId, id: asset.id }, body: { asset: { ...metadata, asset_folder_id } }, signal, throwOnError: true, ...opts }), true);
        const updated = await wrapRequest<Asset, true>(() =>
          mapi.getSpaceSharedAsset({ client, path: { space_id: resolvedSpaceId, id: asset.id }, signal, throwOnError: true, ...opts }), true);
        return updated.data;
      }
      return asset;
    },
    /** Updates a shared asset's metadata, optionally replacing the file. */
    async update(assetId: number | string, options: ({ body: { asset: AssetUpdate }; file?: undefined } | { body: { asset: AssetUpdate; short_filename: string }; file: Blob | ArrayBuffer }) & { signal?: AbortSignal; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<void> {
      const { body, file, signal, path, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      const opts = kyOpts(fetchOptions);

      if (file !== undefined) {
        const { short_filename, ...assetBody } = body as { short_filename: string; asset: AssetUpdate };
        const signResult = await wrapRequest<CreateSpaceSharedAssetResponses[200], true>(() =>
          mapi.createSpaceSharedAsset({ client, path: { space_id: resolvedSpaceId }, query: { filename: short_filename, id: Number(assetId) } as unknown as SignSharedAssetQuery, signal, throwOnError: true, ...opts }), true);
        if (!signResult.data.id) {
          throw new Error('Invalid signed response: missing id');
        }
        await uploadToS3(signResult.data, file, short_filename);
        await wrapRequest<unknown, true>(() =>
          mapi.finishSpaceSharedAssetUpload({ client, path: { space_id: resolvedSpaceId, id: signResult.data.id }, signal, throwOnError: true, ...opts }), true);
        if (assetBody.asset && Object.keys(assetBody.asset).length > 0) {
          await wrapRequest<void, true>(() =>
            mapi.updateSpaceSharedAsset({ client, path: { space_id: resolvedSpaceId, id: Number(assetId) }, body: assetBody, signal, throwOnError: true, ...opts }), true);
        }
      }
      else {
        await wrapRequest<void, true>(() =>
          mapi.updateSpaceSharedAsset({ client, path: { space_id: resolvedSpaceId, id: Number(assetId) }, body, signal, throwOnError: true, ...opts }), true);
      }
    },
    delete<ThrowOnError extends boolean = false>(assetId: number | string, options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<Asset, ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      return wrapRequest<Asset, ThrowOnError>(() =>
        mapi.deleteSpaceSharedAsset({ client, path: { space_id: getSpaceId(path), id: Number(assetId) }, signal, ...maybeThrow(throwOnError), ...kyOpts(fetchOptions) }), throwOnError);
    },
  };
}
