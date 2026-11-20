import { stripVTControlCharacters } from "node:util";
import { describe, expect, it } from "vitest";
import { renderFields } from "./fields-view";

describe("renderFields", () => {
  it("should print one aligned field per row", () => {
    const text = stripVTControlCharacters(
      renderFields({ id: 1, endpoint: "https://example.com", actions: ["a", "b"], note: null }),
    );

    expect(text.split("\n")).toEqual([
      "id        1",
      "endpoint  https://example.com",
      "actions   a, b",
      "note      ",
    ]);
  });

  it("should print an object value as JSON", () => {
    expect(stripVTControlCharacters(renderFields({ config: { a: 1 } }))).toBe('config  {"a":1}');
  });
});
