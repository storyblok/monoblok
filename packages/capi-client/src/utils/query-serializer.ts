// NOTE: This file is intentionally identical to packages/mapi-client/src/utils/query-serializer.ts
// except for the import paths (capi vs mapi generated core). Keep them in sync.

import type { QuerySerializer } from '../generated/capi/core/bodySerializer.gen';
import { serializeArrayParam, serializePrimitiveParam } from '../generated/capi/core/pathSerializer.gen';

/**
 * Query serializer for the Content Delivery API client.
 *
 * Behaves identically to the generated default for primitives, primitive
 * arrays, and dates, but additionally serializes **nested objects** (and arrays
 * of objects) into bracket notation — e.g. `filter_query[enddate][lt_date]=2031-01-01 00:00`.
 *
 * The generated default serializer throws on this nesting ("Deeply-nested
 * arrays/objects aren't supported. Provide your own `querySerializer()`"), yet
 * CAPI requires `filter_query` as a nested hash. This mirrors the bracket
 * serialization used by `storyblok-js-client` and the MAPI client.
 */
function serialize(name: string, value: unknown, parts: string[]): void {
  if (value === undefined || value === null) {
    return;
  }

  if (value instanceof Date) {
    parts.push(`${name}=${value.toISOString()}`);
    return;
  }

  if (Array.isArray(value)) {
    // Arrays containing objects need per-item bracket recursion.
    if (value.some(item => item !== null && typeof item === 'object')) {
      for (const item of value) {
        serialize(`${name}[]`, item, parts);
      }
      return;
    }
    // Primitive arrays keep the generated default form (`name=a&name=b`).
    const serialized = serializeArrayParam({ explode: true, name, style: 'form', value });
    if (serialized) {
      parts.push(serialized);
    }
    return;
  }

  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      serialize(`${name}[${key}]`, child, parts);
    }
    return;
  }

  const serialized = serializePrimitiveParam({ name, value: value as string });
  if (serialized) {
    parts.push(serialized);
  }
}

export const querySerializer: QuerySerializer = (query) => {
  const parts: string[] = [];
  for (const [name, value] of Object.entries(query)) {
    serialize(name, value, parts);
  }
  return parts.join('&');
};
