/**
 * Splits an iterable into batches of at most `size` items, preserving order.
 * Returns `[]` for empty input. If `size <= 0`, returns the full input as a single batch.
 */
export const chunk = <T>(items: Iterable<T>, size: number): T[][] =>
  chunkByWeight(items, { maxSize: size, maxWeight: Infinity, weightOf: () => 0 });

type ChunkByWeightOptions<T> = {
  maxSize: number;
  maxWeight: number;
  weightOf: (item: T) => number;
};

/**
 * Splits an iterable into batches, preserving order, so that each batch holds at most `maxSize`
 * items and their summed `weightOf` stays within `maxWeight`. An item heavier than `maxWeight`
 * gets a batch of its own rather than being dropped. A `maxSize <= 0` means no size limit.
 */
export const chunkByWeight = <T>(
  items: Iterable<T>,
  { maxSize, maxWeight, weightOf }: ChunkByWeightOptions<T>,
): T[][] => {
  const sizeLimit = maxSize > 0 ? maxSize : Infinity;
  const chunks: T[][] = [];
  let current: T[] = [];
  let currentWeight = 0;
  for (const item of items) {
    const weight = weightOf(item);
    if (current.length > 0 && (current.length >= sizeLimit || currentWeight + weight > maxWeight)) {
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
