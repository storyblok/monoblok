import { stripVTControlCharacters } from "node:util";
import { describe, expect, it } from "vitest";
import { renderTable } from "./table";
import type { TableColumn } from "./table";

type Row = { id: string; name: string; slug: string };

const columns: TableColumn<Row>[] = [
  { header: "id", value: (row) => row.id },
  { header: "name", value: (row) => row.name, flexible: true },
  { header: "full slug", value: (row) => row.slug },
];

const render = (rows: string[][], width?: number): string[] =>
  stripVTControlCharacters(renderTable({ columns, rows, width })).split("\n");

describe("renderTable", () => {
  it("should align columns under an upper-case header without trailing padding", () => {
    expect(
      render([
        ["1", "Home", "home"],
        ["22", "Blog", "en/blog"],
      ]),
    ).toEqual(["ID  NAME  FULL SLUG", "1   Home  home", "22  Blog  en/blog"]);
  });

  it("should truncate only the flexible column when the table is wider than the terminal", () => {
    const lines = render([["1", "A very long story name indeed", "en/blog/post"]], 30);

    expect(lines[1]).toBe("1   A very long…  en/blog/post");
    expect(lines[1].length).toBeLessThanOrEqual(30);
  });

  it("should keep the flexible column readable on a very narrow terminal", () => {
    const lines = render([["1", "A very long story name indeed", "en/blog/post"]], 5);

    expect(lines[1]).toBe("1   A very lo…  en/blog/post");
  });

  it("should collapse whitespace so a cell cannot break the layout", () => {
    expect(render([["1", "Line\none\ttwo", "home"]])[1]).toBe("1   Line one two  home");
  });
});
