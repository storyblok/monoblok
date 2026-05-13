import { describe, expect, it } from 'vitest';
import { defineAssetFolder } from './define-asset-folder';

describe('mapi/defineAssetFolder', () => {
  it('should use the folder name as uuid when not provided', () => {
    const result = defineAssetFolder({ name: 'Images' });

    expect(result.id).toBe(1);
    expect(result.uuid).toBe('Images');
    expect(result.name).toBe('Images');
  });

  it('should prefix uuid with parent_uuid for nested folders', () => {
    const result = defineAssetFolder({ name: 'Icons', parent_uuid: 'Images' });

    expect(result.uuid).toBe('Images/Icons');
  });

  it('should allow overriding uuid explicitly', () => {
    const result = defineAssetFolder({ name: 'Images', id: 99, uuid: 'abc-123' });

    expect(result.id).toBe(99);
    expect(result.uuid).toBe('abc-123');
  });

  it('should fall back to name when uuid is empty string', () => {
    const result = defineAssetFolder({ name: 'Images', uuid: '' });

    expect(result.uuid).toBe('Images');
  });
});
