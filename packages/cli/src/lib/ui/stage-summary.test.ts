import { stripVTControlCharacters } from "node:util";
import { describe, expect, it } from "vitest";
import { renderRunSummary } from "./stage-summary";

const plain = (lines: string[]): string[] => lines.map((line) => stripVTControlCharacters(line));

describe("renderRunSummary", () => {
  it("should put the run's time in the headline and align the stages under it", () => {
    const lines = renderRunSummary({
      headline: "Found 210 stories",
      duration: "37.7s",
      stages: [
        { label: "Listing stories", result: "210 listed", duration: "567ms" },
        { label: "Fetching content", result: "210 fetched", duration: "34.6s" },
      ],
    });

    expect(plain(lines)).toEqual([
      "✔ Found 210 stories in 37.7s",
      "",
      "  Listing stories   210 listed   567ms",
      "  Fetching content  210 fetched  34.6s",
    ]);
  });

  it("should not end the stages with a total that reads as their sum", () => {
    const lines = renderRunSummary({
      headline: "Found 1 story",
      duration: "2.6s",
      stages: [{ label: "Listing stories", result: "1 listed", duration: "1.0s" }],
    });

    expect(plain(lines).at(-1)).toBe("  Listing stories  1 listed  1.0s");
  });

  it("should leave out notes that count zero", () => {
    const lines = renderRunSummary({
      headline: "Found 210 stories",
      duration: "1.0s",
      stages: [
        {
          label: "Listing stories",
          result: "210 listed",
          notes: [
            { count: 0, text: "filtered out" },
            { count: 0, text: "failed", failure: true },
          ],
          duration: "567ms",
        },
      ],
    });

    expect(plain(lines)[2]).toBe("  Listing stories  210 listed  567ms");
  });

  it("should flag a stage with failures in the gutter and pluralize its notes", () => {
    const lines = renderRunSummary({
      headline: "Found 200 stories",
      duration: "2.0s",
      stages: [
        {
          label: "Listing stories",
          result: "210 listed",
          notes: [{ count: 3, text: "filtered out" }],
          duration: "567ms",
        },
        {
          label: "Fetching content",
          result: "205 fetched",
          notes: [{ count: 2, text: ["story failed", "stories failed"], failure: true }],
          duration: "1.2s",
        },
      ],
    });

    expect(plain(lines).slice(2)).toEqual([
      "  Listing stories   210 listed · 3 filtered out     567ms",
      "✖ Fetching content  205 fetched · 2 stories failed   1.2s",
    ]);
  });

  it("should mark an incomplete run and say why", () => {
    const lines = renderRunSummary({
      headline: "Found 0 stories",
      duration: "0.4s",
      failed: true,
      qualifier: "incomplete, part of the space could not be listed",
      stages: [],
    });

    expect(plain(lines)).toEqual([
      "✖ Found 0 stories in 0.4s (incomplete, part of the space could not be listed)",
    ]);
  });
});
