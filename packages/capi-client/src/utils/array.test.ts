import { expect, it } from 'vitest';
import { chunkArray } from './array';

it('should chunk arrays by size', () => {
  expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  expect(chunkArray([1, 2], 0)).toEqual([]);
});
