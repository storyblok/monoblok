import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadMigrations, selectMigrationFiles } from "./load-migrations";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__", "load");
const spaceMigrations = path.join(fixtures, "space-migrations");

const importDefault = async (file: string): Promise<unknown> => (await import(file)).default;

describe("loadMigrations", () => {
  it("should return migrations in filename order however the directory lists them", () => {
    const selected = selectMigrationFiles("migrations", ["0010-later.ts", "0002-earlier.ts"]);

    expect(selected).toEqual([
      { id: "0002-earlier", file: "migrations/0002-earlier.ts" },
      { id: "0010-later", file: "migrations/0010-later.ts" },
    ]);
  });

  it("should order unpadded and timestamp prefixes by their numeric value", () => {
    const selected = selectMigrationFiles("m", ["10-b.ts", "20261007-d.ts", "9-a.ts", "010-c.ts"]);

    expect(selected.map((entry) => entry.id)).toEqual(["9-a", "010-c", "10-b", "20261007-d"]);
  });

  it("should refuse two files that would share an id", () => {
    expect(() => selectMigrationFiles("m", ["0001-x.ts", "0001-x.js"])).toThrow(
      /0001-x\.js and 0001-x\.ts share the id "0001-x"/,
    );
  });

  it("should return the compiled migration each file exports", async () => {
    const loaded = await loadMigrations(spaceMigrations, importDefault);

    expect(loaded[0].migration.title).toBe("Rename the card title");
    expect(loaded[0].migration.targets).toEqual(["card"]);
    expect(loaded[0].migration.ops).toEqual([
      { kind: "renameField", block: "card", field: "title", to: "headline" },
    ]);
  });

  it("should ignore schema snapshots and files that are not migrations", async () => {
    const loaded = await loadMigrations(spaceMigrations, importDefault);

    expect(loaded.map((entry) => path.basename(entry.file))).toEqual([
      "0001-rename-card-title.ts",
      "0002-drop-card-subtitle.ts",
    ]);
  });

  it("should report the file whose default export is not a migration", async () => {
    await expect(
      loadMigrations(path.join(fixtures, "broken-migrations"), importDefault),
    ).rejects.toThrow(/0001-broken/);
  });

  it("should return an empty list for a directory that does not exist", async () => {
    expect(await loadMigrations(path.join(fixtures, "no-such-directory"), importDefault)).toEqual(
      [],
    );
  });
});
