import * as mapi from "../generated/mapi/sdk.gen";
import type {
  CreateWebhookEndpointData,
  CreateWebhookEndpointResponses,
  DeleteWebhookEndpointResponses,
  GetWebhookEndpointResponses,
  ListWebhookAllowedActionsResponses,
  ListWebhookEndpointsResponses,
  UpdateWebhookEndpointData,
  UpdateWebhookEndpointResponses,
} from "../generated/mapi/types.gen";
import type { ApiResponse, FetchOptions, MapiResourceDeps } from "../client";
import { buildCallOptions, resolveSpaceId, type SpaceIdPathOverride } from "./shared";

export function createWebhooksResource<DefaultThrowOnError extends boolean = false>(
  deps: MapiResourceDeps<DefaultThrowOnError>,
) {
  const { client, spaceId, wrapRequest } = deps;
  const getSpaceId = (path?: SpaceIdPathOverride["path"]) => resolveSpaceId(spaceId, path);

  return {
    list<ThrowOnError extends boolean = DefaultThrowOnError>(
      options: {
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<ListWebhookEndpointsResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<ListWebhookEndpointsResponses[200], ThrowOnError>(
        () =>
          mapi.listWebhookEndpoints({
            client,
            path: { space_id: resolvedSpaceId },
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
    get<ThrowOnError extends boolean = DefaultThrowOnError>(
      webhookId: number,
      options: {
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<GetWebhookEndpointResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<GetWebhookEndpointResponses[200], ThrowOnError>(
        () =>
          mapi.getWebhookEndpoint({
            client,
            path: { space_id: resolvedSpaceId, id: webhookId },
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
    create<ThrowOnError extends boolean = DefaultThrowOnError>(
      options: {
        body: CreateWebhookEndpointData["body"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride,
    ): Promise<ApiResponse<CreateWebhookEndpointResponses[201], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<CreateWebhookEndpointResponses[201], ThrowOnError>(
        () =>
          mapi.createWebhookEndpoint({
            client,
            path: { space_id: resolvedSpaceId },
            body,
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
    update<ThrowOnError extends boolean = DefaultThrowOnError>(
      webhookId: number,
      options: {
        body: UpdateWebhookEndpointData["body"];
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride,
    ): Promise<ApiResponse<UpdateWebhookEndpointResponses[200], ThrowOnError>> {
      const { body, signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<UpdateWebhookEndpointResponses[200], ThrowOnError>(
        () =>
          mapi.updateWebhookEndpoint({
            client,
            path: { space_id: resolvedSpaceId, id: webhookId },
            body,
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
    delete<ThrowOnError extends boolean = DefaultThrowOnError>(
      webhookId: number,
      options: {
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<DeleteWebhookEndpointResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<DeleteWebhookEndpointResponses[200], ThrowOnError>(
        () =>
          mapi.deleteWebhookEndpoint({
            client,
            path: { space_id: resolvedSpaceId, id: webhookId },
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
    /** Lists the event actions a webhook can subscribe to, e.g. `story.published`. */
    allowedActions<ThrowOnError extends boolean = DefaultThrowOnError>(
      options: {
        signal?: AbortSignal;
        throwOnError?: ThrowOnError;
        fetchOptions?: FetchOptions;
      } & SpaceIdPathOverride = {},
    ): Promise<ApiResponse<ListWebhookAllowedActionsResponses[200], ThrowOnError>> {
      const { signal, path, throwOnError, fetchOptions } = options;
      const resolvedSpaceId = getSpaceId(path);
      return wrapRequest<ListWebhookAllowedActionsResponses[200], ThrowOnError>(
        () =>
          mapi.listWebhookAllowedActions({
            client,
            path: { space_id: resolvedSpaceId },
            signal,
            ...buildCallOptions(client, throwOnError, fetchOptions),
          }),
        throwOnError,
      );
    },
  };
}
