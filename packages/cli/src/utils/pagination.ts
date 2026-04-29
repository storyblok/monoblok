/**
 * Generic pagination helper that fetches all pages of data.
 *
 * Uses the `total` response header to determine when all pages have been fetched.
 * Falls back to a single-page response when the header is absent.
 *
 * @param fetchFunction - Function that fetches a single page
 * @param extractDataFunction - Function that extracts data array from response
 * @param page - Current page number
 * @param collectedItems - Previously collected items
 * @returns Array of all items across all pages
 */
export async function fetchAllPages<T, R>(
  fetchFunction: (page: number) => Promise<{ data: T; response: Response }>,
  extractDataFunction: (data: T) => R[],
  page = 1,
  collectedItems: R[] = [],
): Promise<R[]> {
  const { data, response } = await fetchFunction(page);
  const totalHeader = (response.headers.get('total'));
  const total = Number(totalHeader);

  const fetchedItems = extractDataFunction(data);
  const allItems = [...collectedItems, ...fetchedItems];

  if (!totalHeader || Number.isNaN(total)) {
    // No valid 'total' header — assume not paginated, return all collected items plus current page
    return allItems;
  }

  if (allItems.length < total && fetchedItems.length > 0) {
    return fetchAllPages(fetchFunction, extractDataFunction, page + 1, allItems);
  }
  return allItems;
}
