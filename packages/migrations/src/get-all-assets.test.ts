import { describe, expect, it, vi } from 'vitest';

import { getAllAssets } from './get-all-assets';

function mockListResponse(assets: unknown[], total: number, perPage: number) {
  return {
    data: { assets },
    response: {
      headers: new Headers({
        'total': String(total),
        'per-page': String(perPage),
      }),
    } as Response,
  };
}

describe('getAllAssets', () => {
  it('should return all assets from a single page', async () => {
    const fn = vi
      .fn()
      .mockResolvedValue(mockListResponse(['a', 'b', 'c'], 3, 25));
    const result = await getAllAssets(fn);
    expect(result).toEqual(['a', 'b', 'c']);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);
  });

  it('should fetch multiple pages and concatenate results', async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce(
        mockListResponse(
          Array.from({ length: 100 }, (_, i) => i),
          250,
          100,
        ),
      )
      .mockResolvedValueOnce(
        mockListResponse(
          Array.from({ length: 100 }, (_, i) => i + 100),
          250,
          100,
        ),
      )
      .mockResolvedValueOnce(
        mockListResponse(
          Array.from({ length: 50 }, (_, i) => i + 200),
          250,
          100,
        ),
      );
    const result = await getAllAssets(fn);
    expect(result).toHaveLength(250);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(fn).toHaveBeenNthCalledWith(1, 1);
    expect(fn).toHaveBeenNthCalledWith(2, 2);
    expect(fn).toHaveBeenNthCalledWith(3, 3);
  });

  it('should return empty array when total is 0', async () => {
    const fn = vi
      .fn()
      .mockResolvedValue(mockListResponse([], 0, 25));
    const result = await getAllAssets(fn);
    expect(result).toEqual([]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should throw when data is undefined', async () => {
    const fn = vi.fn().mockResolvedValue({
      data: undefined,
      response: { headers: new Headers() } as Response,
    });
    await expect(getAllAssets(fn)).rejects.toThrow('Failed to fetch assets');
  });

  it('should propagate errors from the fetch function', async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce(mockListResponse(['a'], 2, 1))
      .mockRejectedValueOnce(new Error('Network error'));
    await expect(getAllAssets(fn)).rejects.toThrow('Network error');
  });

  it('should call fn sequentially (not concurrently)', async () => {
    const callOrder: number[] = [];
    const fn = vi.fn().mockImplementation(async (page: number) => {
      callOrder.push(page);
      return mockListResponse(['item'], 2, 1);
    });
    await getAllAssets(fn);
    expect(callOrder).toEqual([1, 2]);
  });
});
