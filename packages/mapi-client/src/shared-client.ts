// Shared client for all generated SDKs
import { createClient, type Client, type Config } from './client';

// Create a shared client instance that can be used by all generated SDKs
export const sharedClient = createClient();

// Export types for generated SDKs
export type { Client, Config } from './client';

// Helper to create a client with custom config
export const createSharedClient = (config?: Config): Client => {
  return createClient(config);
}; 
