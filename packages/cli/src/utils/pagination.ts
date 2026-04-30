/**
 * Fetches every page of a list endpoint and returns the combined items.
 * Stops when the `total` response header is reached, when a page returns
 * no items, or immediately if the header is absent (treats the response
 * as un-paginated).
 *
 * @param fetchFunction - Fetches a single page; receives the 1-based page number
 * @param extractDataFunction - Extracts the items array from a page's response data
 */
export async function fetchAllPages<T, R>(
  fetchFunction: (page: number) => Promise<{ data: T; response: Response }>,
  extractDataFunction: (data: T) => R[],
): Promise<R[]> {
  const items: R[] = [];
  let page = 1;

  while (true) {
    const { data, response } = await fetchFunction(page);
    const totalHeader = response.headers.get("total");
    const fetchedItems = extractDataFunction(data);
    items.push(...fetchedItems);

    if (!totalHeader) {
      return items;
    }
    const total = Number(totalHeader);
    if (Number.isNaN(total) || items.length >= total || fetchedItems.length === 0) {
      return items;
    }
    page++;
  }
}
