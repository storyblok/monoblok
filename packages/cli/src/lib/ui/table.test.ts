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

  it("should not widen a short flexible column when the table is too wide", () => {
    const lines = render([["1", "Home", "en/a-very-long-slug-that-overflows"]], 20);

    expect(lines[1]).toBe("1   Home  en/a-very-long-slug-that-overflows");
  });

  // Story data is untrusted: an escape sequence would recolor, move the
  // cursor, or set the window title when the table is printed.
  it("should show control characters instead of sending them to the terminal", () => {
    const table = renderTable({ columns, rows: [["1", "Evil\x1b]0;PWNED\x07", "\x1b[31mhome"]] });

    expect(table.split("\n")[1]).toBe("1   Evil\uFFFD]0;PWNED\uFFFD  \uFFFD[31mhome");
  });

  it("should align wide characters by terminal columns", () => {
    const lines = render([
      ["1", "日本語", "ja"],
      ["2", "Latin", "en"],
      ["3", "Cafe\u0301", "fr"],
    ]);

    expect(lines.slice(1)).toEqual(["1   日本語  ja", "2   Latin   en", "3   Cafe\u0301    fr"]);
  });

  it("should never cut a grapheme in half when truncating", () => {
    const lines = render([["1", "Emoji 🚀🎉 launch party", "home"]], 18);

    expect(lines[1]).toBe("1   Emoji 🚀…   home");
  });
});
