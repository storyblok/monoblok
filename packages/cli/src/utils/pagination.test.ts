import { describe, expect, it } from "vitest";
import { fetchAllPages } from "./pagination";

interface Page {
  items: number[];
}

function makeResponse(items: number[], total?: number) {
  const headers = new Headers();
  if (total !== undefined) {
    headers.set("total", String(total));
  }
  return {
    data: { items },
    response: new Response(null, { headers }),
  };
}

describe("fetchAllPages", () => {
  it("returns an empty array when the first page has no items and no total header", async () => {
    const calls: number[] = [];
    const result = await fetchAllPages<Page, number>(
      (page) => {
        calls.push(page);
        return Promise.resolve(makeResponse([]));
      },
      (data) => data.items,
    );

    expect(result).toEqual([]);
    expect(calls).toEqual([1]);
  });

  it("returns the single page when no total header is present", async () => {
    const calls: number[] = [];
    const result = await fetchAllPages<Page, number>(
      (page) => {
        calls.push(page);
        return Promise.resolve(makeResponse([1, 2, 3]));
      },
      (data) => data.items,
    );

    expect(result).toEqual([1, 2, 3]);
    expect(calls).toEqual([1]);
  });

  it("combines all pages until total is reached", async () => {
    const total = 7;
    const pages: Record<number, number[]> = {
      1: [1, 2, 3],
      2: [4, 5, 6],
      3: [7],
    };
    const calls: number[] = [];

    const result = await fetchAllPages<Page, number>(
      (page) => {
        calls.push(page);
        return Promise.resolve(makeResponse(pages[page] ?? [], total));
      },
      (data) => data.items,
    );

    expect(result).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(calls).toEqual([1, 2, 3]);
  });

  it("stops when a page returns no items even if total has not been reached", async () => {
    // Defends against infinite loops if the API misreports total or items get deleted mid-fetch.
    const calls: number[] = [];
    const result = await fetchAllPages<Page, number>(
      (page) => {
        calls.push(page);
        if (page === 1) {
          return Promise.resolve(makeResponse([1, 2], 99));
        }
        return Promise.resolve(makeResponse([], 99));
      },
      (data) => data.items,
    );

    expect(result).toEqual([1, 2]);
    expect(calls).toEqual([1, 2]);
  });

  it("stops when collected items already match or exceed total after the first page", async () => {
    // Total smaller than what the first page returns — should not request a second page.
    const calls: number[] = [];
    const result = await fetchAllPages<Page, number>(
      (page) => {
        calls.push(page);
        return Promise.resolve(makeResponse([1, 2, 3, 4, 5], 3));
      },
      (data) => data.items,
    );

    expect(result).toEqual([1, 2, 3, 4, 5]);
    expect(calls).toEqual([1]);
  });
});
