export async function getAllPaginated<T>(
  key: string,
  fn: (page: number) => Promise<{
    data: Record<string, T[] | undefined> | undefined;
    response: Response;
  }>,
): Promise<T[]> {
  const firstPage = await fn(1);

  if (!firstPage.data) {
    throw new Error(`Failed to fetch ${key}`);
  }

  const total = Number(firstPage.response.headers.get('total') || 0);
  const perPage = Number(firstPage.response.headers.get('per-page') || 25);
  const allItems: T[] = [...(firstPage.data[key] ?? [])];

  const totalPages = Math.ceil(total / perPage);

  for (let page = 2; page <= totalPages; page++) {
    const response = await fn(page);
    allItems.push(...(response.data?.[key] ?? []));
  }

  return allItems;
}
