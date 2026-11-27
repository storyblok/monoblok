import { describe, expect, it } from "vitest";
import { formatRuns } from "./actions";

const run = {
  id: "2026-09-23T10-00-00-000Z-0001-rename",
  space: "12345",
  migration: "0001-rename",
  appliedAt: "2026-09-23T10:00:00.000Z",
  stories: 3,
  blocks: 7,
};

describe("formatRuns", () => {
  it("prints the id, the migration, and what it touched", () => {
    expect(formatRuns([run])[0]).toContain("0001-rename");
    expect(formatRuns([run])[0]).toContain("3 stories");
    expect(formatRuns([run])[0]).toContain("7 blocks");
  });

  it("uses the singular for a run that touched one story", () => {
    expect(formatRuns([{ ...run, stories: 1, blocks: 1 }])[0]).toContain("1 story");
    expect(formatRuns([{ ...run, stories: 1, blocks: 1 }])[0]).toContain("1 block");
  });

  it("prefers the title over the migration id when one was given", () => {
    expect(formatRuns([{ ...run, title: "Rename the byline" }])[0]).toContain("Rename the byline");
  });

  it("returns an empty list unchanged", () => {
    expect(formatRuns([])).toEqual([]);
  });

  it("keeps the order it was handed rather than re-sorting", () => {
    // Ids sort chronologically (see the engine's journal), so `list` hands
    // this function runs already ordered oldest first without opening every
    // entry. Reordering here would undo that and defeat the point.
    const earlier = { ...run, id: "2026-09-23T09-00-00-000Z-0001-rename" };
    const later = { ...run, id: "2026-09-23T11-00-00-000Z-0002-rename", migration: "0002-rename" };

    const lines = formatRuns([later, earlier]);

    expect(lines[0]).toContain(later.id);
    expect(lines[1]).toContain(earlier.id);
  });
});
