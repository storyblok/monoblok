import type { Asset, AssetUpdate } from '../generated/assets/types.gen';
import type { ApiResponse, FetchOptions, MapiResourceDeps } from '../index';
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
  validate_upload?: number;
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

interface SignResponse {
  id?: number;
  post_url?: string;
  fields?: Record<string, unknown>;
}

/**
 * Shared (organization-level) assets. These endpoints are not part of the
 * generated SDK, so methods issue raw `client.*` calls. The active space must
 * have read (list/get) or write (create/update/delete) access to the library.
 */
export function createSharedAssetsResource(deps: MapiResourceDeps) {
  const { client, spaceId, wrapRequest } = deps;
  const getSpaceId = (path?: SpaceIdPathOverride['path']) => resolveSpaceId(spaceId, path);
  const kyOpts = (fetchOptions?: FetchOptions) =>
    fetchOptions ? { kyOptions: { ...client.getConfig().kyOptions, ...fetchOptions } } : {};
  const maybeThrow = (throwOnError?: boolean) => (throwOnError === undefined ? {} : { throwOnError });

  return {
    list<ThrowOnError extends boolean = false>(options: { query?: SharedAssetListQuery; signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<SharedAssetListResponse, ThrowOnError>> {
      const { query, signal, path, throwOnError, fetchOptions } = options;
      return wrapRequest<SharedAssetListResponse, ThrowOnError>(() =>
        client.get({ url: '/v1/spaces/{space_id}/shared_assets', path: { space_id: getSpaceId(path) }, query, signal, ...maybeThrow(throwOnError), ...kyOpts(fetchOptions) }), throwOnError);
    },
    get<ThrowOnError extends boolean = false>(assetId: number | string, options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<Asset, ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      return wrapRequest<Asset, ThrowOnError>(() =>
        client.get({ url: '/v1/spaces/{space_id}/shared_assets/{asset_id}', path: { space_id: getSpaceId(path), asset_id: assetId }, signal, ...maybeThrow(throwOnError), ...kyOpts(fetchOptions) }), throwOnError);
    },
    /** Uploads a file to a shared library (sign → S3 → finish_upload → get). */
    async upload(options: { body: SharedAssetUploadRequest; file: Blob | ArrayBuffer; signal?: AbortSignal; fetchOptions?: FetchOptions } & SpaceIdPathOverride): Promise<Asset> {
      const { body, file, signal, path, fetchOptions } = options;
      const { short_filename, ...rest } = body;
      const resolvedSpaceId = getSpaceId(path);
      const opts = kyOpts(fetchOptions);

      const signResult = await wrapRequest<SignResponse, true>(() =>
        client.post({ url: '/v1/spaces/{space_id}/shared_assets', path: { space_id: resolvedSpaceId }, query: { filename: short_filename, ...rest }, signal, throwOnError: true, ...opts }), true);
      if (!signResult.data.id) {
        throw new Error('Invalid signed response: missing id');
      }
      const assetId = signResult.data.id;

      await uploadToS3(signResult.data, file, short_filename);

      await wrapRequest<unknown, true>(() =>
        client.get({ url: '/v1/spaces/{space_id}/shared_assets/{asset_id}/finish_upload', path: { space_id: resolvedSpaceId, asset_id: assetId }, signal, throwOnError: true, ...opts }), true);

      const getResult = await wrapRequest<Asset, true>(() =>
        client.get({ url: '/v1/spaces/{space_id}/shared_assets/{asset_id}', path: { space_id: resolvedSpaceId, asset_id: assetId }, signal, throwOnError: true, ...opts }), true);
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
          client.put({ url: '/v1/spaces/{space_id}/shared_assets/{asset_id}', path: { space_id: resolvedSpaceId, asset_id: asset.id }, body: { asset: { ...metadata, asset_folder_id } }, signal, throwOnError: true, ...opts }), true);
        const updated = await wrapRequest<Asset, true>(() =>
          client.get({ url: '/v1/spaces/{space_id}/shared_assets/{asset_id}', path: { space_id: resolvedSpaceId, asset_id: asset.id }, signal, throwOnError: true, ...opts }), true);
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
        const signResult = await wrapRequest<SignResponse, true>(() =>
          client.post({ url: '/v1/spaces/{space_id}/shared_assets', path: { space_id: resolvedSpaceId }, query: { filename: short_filename, id: Number(assetId) }, signal, throwOnError: true, ...opts }), true);
        if (!signResult.data.id) {
          throw new Error('Invalid signed response: missing id');
        }
        await uploadToS3(signResult.data, file, short_filename);
        await wrapRequest<unknown, true>(() =>
          client.get({ url: '/v1/spaces/{space_id}/shared_assets/{asset_id}/finish_upload', path: { space_id: resolvedSpaceId, asset_id: signResult.data.id }, signal, throwOnError: true, ...opts }), true);
        if (assetBody.asset && Object.keys(assetBody.asset).length > 0) {
          await wrapRequest<void, true>(() =>
            client.put({ url: '/v1/spaces/{space_id}/shared_assets/{asset_id}', path: { space_id: resolvedSpaceId, asset_id: assetId }, body: assetBody, signal, throwOnError: true, ...opts }), true);
        }
      }
      else {
        await wrapRequest<void, true>(() =>
          client.put({ url: '/v1/spaces/{space_id}/shared_assets/{asset_id}', path: { space_id: resolvedSpaceId, asset_id: assetId }, body, signal, throwOnError: true, ...opts }), true);
      }
    },
    delete<ThrowOnError extends boolean = false>(assetId: number | string, options: { signal?: AbortSignal; throwOnError?: ThrowOnError; fetchOptions?: FetchOptions } & SpaceIdPathOverride = {}): Promise<ApiResponse<Asset, ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      return wrapRequest<Asset, ThrowOnError>(() =>
        client.delete({ url: '/v1/spaces/{space_id}/shared_assets/{asset_id}', path: { space_id: getSpaceId(path), asset_id: assetId }, signal, ...maybeThrow(throwOnError), ...kyOpts(fetchOptions) }), throwOnError);
    },
  };
}
