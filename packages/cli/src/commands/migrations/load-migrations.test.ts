import { fileURLToPath } from "node:url";
import { dirname, join } from "pathe";
import { describe, expect, it, vi } from "vitest";
import { loadMigrations } from "./load-migrations";

// Discovery hands real file paths to jiti, which reads them through the real
// filesystem rather than the memfs volume the global setup installs.
vi.unmock("node:fs");
vi.unmock("node:fs/promises");

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__");

describe("loadMigrations", () => {
  it("should return migrations ordered by filename, keyed by the filename", async () => {
    const loaded = await loadMigrations(join(fixtures, "space-migrations"));

    expect(loaded.map((entry) => entry.id)).toEqual([
      "0001-rename-card-title",
      "0002-drop-card-subtitle",
    ]);
  });

  it("should return the compiled migration each file exports", async () => {
    const loaded = await loadMigrations(join(fixtures, "space-migrations"));

    expect(loaded[0].migration.title).toBe("Rename the card title");
    expect(loaded[0].migration.targets).toEqual(["card"]);
    expect(loaded[0].migration.ops).toEqual([
      { kind: "renameField", block: "card", field: "title", to: "headline" },
    ]);
  });

  it("should ignore snapshots and files that are not migrations", async () => {
    const loaded = await loadMigrations(join(fixtures, "space-migrations"));

    expect(loaded.map((entry) => entry.file.endsWith(".before.ts"))).not.toContain(true);
    expect(loaded).toHaveLength(2);
  });

  it("should report the file whose default export is not a migration", async () => {
    await expect(loadMigrations(join(fixtures, "broken-migrations"))).rejects.toThrow(
      /0001-broken/,
    );
  });

  it("should return an empty list for a directory that does not exist", async () => {
    expect(await loadMigrations(join(fixtures, "no-such-directory"))).toEqual([]);
  });
});
