import { contentClient, StoryblokContentClientOptions } from './index';
import { describe, it, expect, beforeEach } from 'vitest';
import { vi } from 'vitest';

describe('contentClient', () => {
  const mockOptions: StoryblokContentClientOptions = {
    accessToken: 'test-token'
  };

  beforeEach(() => {
    // Reset the module between tests
    vi.resetModules();
  });

  it('should return client name', () => {
    expect(contentClient(mockOptions).getClientName()).toBe('content-client');
  });

  it('should maintain singleton instance with state', () => {
    const instance1 = contentClient(mockOptions);
    const instance2 = contentClient();
    
    expect(instance2).toBe(instance1);
  });
});
