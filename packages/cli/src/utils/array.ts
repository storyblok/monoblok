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

/**
 * Splits an iterable into batches, preserving order, so that each batch holds at most `maxSize`
 * items and their summed `weightOf` stays within `maxWeight`. An item heavier than `maxWeight` on
 * its own still gets a batch of its own rather than being dropped.
 */
export const chunkByWeight = <T>(
  items: Iterable<T>,
  {
    maxSize,
    maxWeight,
    weightOf,
  }: { maxSize: number; maxWeight: number; weightOf: (item: T) => number },
): T[][] => {
  const chunks: T[][] = [];
  let current: T[] = [];
  let currentWeight = 0;
  for (const item of items) {
    const weight = weightOf(item);
    if (current.length > 0 && (current.length >= maxSize || currentWeight + weight > maxWeight)) {
      chunks.push(current);
      current = [];
      currentWeight = 0;
    }
    current.push(item);
    currentWeight += weight;
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks;
};
