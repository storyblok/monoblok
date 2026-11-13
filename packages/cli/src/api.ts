import {
  createManagementApiClient,
  type ManagementApiClient,
  type ManagementApiClientConfig,
} from "@storyblok/management-api-client";

import { getActiveConfig } from "./lib/config";

let instance: ManagementApiClient | null = null;
let storedConfig: ManagementApiClientConfig | null = null;

function configsAreEqual(
  config1: ManagementApiClientConfig,
  config2: ManagementApiClientConfig,
): boolean {
  const keys = new Set([...Object.keys(config1), ...Object.keys(config2)]);
  return [...keys].every((key) => {
    const value1 = config1[key as keyof ManagementApiClientConfig];
    const value2 = config2[key as keyof ManagementApiClientConfig];
    // JSON.stringify drops functions, which would make every token provider look
    // identical and hand back a client bound to the previous session's credential.
    if (typeof value1 === "function" || typeof value2 === "function") {
      return value1 === value2;
    }
    return JSON.stringify(value1) === JSON.stringify(value2);
  });
}

export function createMapiClient(options: ManagementApiClientConfig) {
  const { api } = getActiveConfig();
  return createManagementApiClient({
    ...options,
    rateLimit: options.rateLimit ?? (api.rateLimit > 0 ? api.rateLimit : false),
  });
}

export function getMapiClient(options?: ManagementApiClientConfig) {
  if (!instance && options) {
    instance = createMapiClient(options);
    storedConfig = options;
  } else if (!instance) {
    throw new Error("MAPI client not initialized. Call getMapiClient with configuration first.");
  } else if (options && storedConfig && !configsAreEqual(options, storedConfig)) {
    // Create new instance if options differ from stored config
    instance = createMapiClient(options);
    storedConfig = options;
  }
  return instance;
}
