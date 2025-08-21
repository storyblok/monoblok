import { ManagementApiClient, type ManagementApiClientConfig } from '@storyblok/management-api-client';

let instance: ManagementApiClient | null = null;

export function mapiClient(options?: ManagementApiClientConfig) {
  if (!instance && options) {
    instance = new ManagementApiClient(options);
  }
  else if (!instance) {
    throw new Error('MAPI client not initialized. Call mapiClient with configuration first.');
  }
  return instance;
}
