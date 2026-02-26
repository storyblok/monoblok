import { getAllPaginated } from './get-all-paginated';

export async function getAllStories<T>(
  fn: (page: number) => Promise<{
    data: { stories?: T[] } | undefined;
    response: Response;
  }>,
): Promise<T[]> {
  return getAllPaginated<T>('stories', fn);
}
