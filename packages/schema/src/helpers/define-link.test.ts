import { describe, expect, it } from 'vitest';
import { defineLink } from './define-link';

describe('defineLink', () => {
  it('should fill structural fields with defaults when not provided', () => {
    const result = defineLink({ name: 'Home', slug: 'home' });

    expect(result.id).toBe(1);
    expect(result.uuid).toBe('');
    expect(result.path).toBeNull();
    expect(result.real_path).toBe('');
    expect(result.is_folder).toBe(false);
    expect(result.published).toBe(false);
    expect(result.is_startpage).toBe(false);
    expect(result.position).toBe(0);
    expect(result.name).toBe('Home');
    expect(result.slug).toBe('home');
  });

  it('should allow overriding defaults', () => {
    const result = defineLink({ name: 'Home', slug: 'home', id: 99, published: true, position: 5 });

    expect(result.id).toBe(99);
    expect(result.published).toBe(true);
    expect(result.position).toBe(5);
  });
});
