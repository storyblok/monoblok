import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const names = (
  folder: string,
  keep: (entry: { name: string; isDirectory(): boolean }) => boolean,
) =>
  readdirSync(new URL(folder, import.meta.url), { withFileTypes: true })
    .filter(keep)
    .map((entry) => entry.name.replace(/\.ts$/, ""))
    .toSorted();

describe("configs", () => {
  it("should have exactly one smoke config per blueprint", () => {
    expect(names("../configs/", (entry) => entry.name.endsWith(".ts"))).toEqual(
      names("../../../blueprints/", (entry) => entry.isDirectory()),
    );
  });
});
