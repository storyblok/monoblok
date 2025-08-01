import { MapiClient, type MapiClientConfig } from '@storyblok/mapi-client';

let instance: MapiClient | null = null;

export function mapiClient(options?: MapiClientConfig) {
  if (!instance && options) {
    instance = new MapiClient(options);
  }
  if (!instance) {
    throw new Error('MAPI client not initialized. Call mapiClient with configuration first.');
  }
  return instance;
}
