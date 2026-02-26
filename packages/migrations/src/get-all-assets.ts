import { getAllPaginated } from './get-all-paginated';

export async function getAllAssets<T>(
  fn: (page: number) => Promise<{
    data: { assets?: T[] } | undefined;
    response: Response;
  }>,
): Promise<T[]> {
  return getAllPaginated<T>('assets', fn);
}
