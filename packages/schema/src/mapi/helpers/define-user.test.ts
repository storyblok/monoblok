import { describe, expect, it } from 'vitest';
import { defineUser } from './define-user';

describe('mapi/defineUser', () => {
  it('should fill id, created_at and updated_at with defaults when not provided', () => {
    const result = defineUser({ email: 'dev@example.com' });

    expect(result.id).toBe(1);
    expect(result.created_at).toBe('');
    expect(result.updated_at).toBe('');
    expect(result.email).toBe('dev@example.com');
  });

  it('should allow overriding defaults', () => {
    const result = defineUser({ email: 'dev@example.com', id: 99, created_at: '2024-01-01', updated_at: '2024-06-01' });

    expect(result.id).toBe(99);
    expect(result.created_at).toBe('2024-01-01');
  });
});
