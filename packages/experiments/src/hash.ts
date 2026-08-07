/**
 * FNV-1a, a small non-cryptographic hash. Hand-rolled (a few lines, not the
 * kind of error-prone work the dependency rule guards against) to map a string
 * to a stable `0..99` bucket. This is what makes variant assignment
 * deterministic and storage-free: the same input always lands in the same
 * bucket, on every request.
 */
const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;

export function hashToBucket(input: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  // `>>> 0` coerces to an unsigned 32-bit int before mapping into `0..99`.
  return (hash >>> 0) % 100;
}
