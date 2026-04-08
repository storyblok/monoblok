import { describe, expect, it } from 'vitest';
import { defineAssetFolder } from './define-asset-folder';

describe('mapi/defineAssetFolder', () => {
  it('should fill id and uuid with defaults when not provided', () => {
    const result = defineAssetFolder({ name: 'Images' });

    expect(result.id).toBe(1);
    expect(result.uuid).toBe('');
    expect(result.name).toBe('Images');
  });

  it('should allow overriding defaults', () => {
    const result = defineAssetFolder({ name: 'Images', id: 99, uuid: 'abc-123' });

    expect(result.id).toBe(99);
    expect(result.uuid).toBe('abc-123');
  });
});
