import { describe, expect, it } from 'vitest';
import { defineComponentFolder } from './define-component-folder';

describe('mapi/defineComponentFolder', () => {
  it('should fill id and uuid with defaults when not provided', () => {
    const result = defineComponentFolder({ name: 'Layout' });

    expect(result.id).toBe(1);
    expect(result.uuid).toBe('');
    expect(result.name).toBe('Layout');
  });

  it('should allow overriding defaults', () => {
    const result = defineComponentFolder({ name: 'Layout', id: 99, uuid: 'abc-123' });

    expect(result.id).toBe(99);
    expect(result.uuid).toBe('abc-123');
  });
});
