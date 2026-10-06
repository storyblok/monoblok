import { fileURLToPath } from "node:url";
import { dirname, join } from "pathe";
import { describe, expect, it, vi } from "vitest";
import { loadMigrations } from "./load-migrations";

// Discovery hands real file paths to jiti, which reads them through the real
// filesystem rather than the memfs volume the global setup installs. `readdir`
// stays spyable so a test can dictate the order the directory is listed in,
// which a real filesystem does not guarantee either way.
vi.unmock("node:fs");
const { readdirSpy } = vi.hoisted(() => ({ readdirSpy: vi.fn() }));
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  readdirSpy.mockImplementation(actual.readdir);
  return { ...actual, readdir: readdirSpy };
});

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__");
const spaceMigrations = join(fixtures, "space-migrations");

const listedAs = (...files: string[]): void => {
  readdirSpy.mockResolvedValueOnce(files);
};

describe("loadMigrations", () => {
  it("should return migrations in filename order however the directory lists them", async () => {
    listedAs("0002-drop-card-subtitle.ts", "0001-rename-card-title.ts");

    const loaded = await loadMigrations(spaceMigrations);

    expect(loaded.map((entry) => entry.id)).toEqual([
      "0001-rename-card-title",
      "0002-drop-card-subtitle",
    ]);
  });

  it("should return the compiled migration each file exports", async () => {
    const loaded = await loadMigrations(spaceMigrations);

    expect(loaded[0].migration.title).toBe("Rename the card title");
    expect(loaded[0].migration.targets).toEqual(["card"]);
    expect(loaded[0].migration.ops).toEqual([
      { kind: "renameField", block: "card", field: "title", to: "headline" },
    ]);
  });

  it("should ignore schema snapshots and files that are not migrations", async () => {
    const loaded = await loadMigrations(spaceMigrations);

    expect(loaded.map((entry) => entry.file)).toEqual([
      join(spaceMigrations, "0001-rename-card-title.ts"),
      join(spaceMigrations, "0002-drop-card-subtitle.ts"),
    ]);
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
