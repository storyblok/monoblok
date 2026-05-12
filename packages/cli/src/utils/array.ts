/**
 * Splits an iterable into batches of at most `size` items, preserving order.
 * Returns `[]` for empty input. If `size <= 0`, returns the full input as a single batch.
 */
export const chunk = <T>(items: Iterable<T>, size: number): T[][] => {
  const all = Array.from(items);
  if (all.length === 0) {
    return [];
  }
  if (size <= 0) {
    return [all];
  }
  const chunks: T[][] = [];
  for (let i = 0; i < all.length; i += size) {
    chunks.push(all.slice(i, i + size));
  }
  return chunks;
};
