import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadMigrations, nextMigrationId, selectMigrationFiles } from "./load-migrations";

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

  it("should leave the schema snapshots beside migrations alone", () => {
    const selected = selectMigrationFiles("m", ["0001-x.ts", "0001-x.before.ts"]);

    expect(selected.map((entry) => entry.id)).toEqual(["0001-x"]);
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

  it("should load only the named migration and import no other file", async () => {
    const imported: string[] = [];
    const loaded = await loadMigrations(
      spaceMigrations,
      async (file) => {
        imported.push(path.basename(file));
        return importDefault(file);
      },
      { only: "0002-drop-card-subtitle" },
    );

    expect(loaded.map((entry) => entry.id)).toEqual(["0002-drop-card-subtitle"]);
    expect(imported).toEqual(["0002-drop-card-subtitle.ts"]);
  });

  it("should name the file that failed to load", async () => {
    await expect(
      loadMigrations(spaceMigrations, async () => {
        throw new Error("boom at import");
      }),
    ).rejects.toThrow(/0001-rename-card-title\.ts could not be loaded: boom at import/);
  });

  it("should return an empty list for a directory that does not exist", async () => {
    expect(await loadMigrations(path.join(fixtures, "no-such-directory"), importDefault)).toEqual(
      [],
    );
  });
});

describe("nextMigrationId", () => {
  it("should start at 0001 in an empty directory", () => {
    expect(nextMigrationId([], "rename card title")).toBe("0001-rename-card-title");
  });

  it("should follow the highest existing prefix, keeping its width", () => {
    expect(nextMigrationId(["0002-a", "0010-b", "0009-c"], "next")).toBe("0011-next");
    expect(nextMigrationId(["00007-a"], "next")).toBe("00008-next");
  });

  it("should reduce the name to a slug the loader accepts", () => {
    const id = nextMigrationId([], "Update heroBlock & card_v2!");

    expect(id).toBe("0001-update-hero-block-card-v2");
    expect(selectMigrationFiles("m", [`${id}.ts`])).toHaveLength(1);
    expect(nextMigrationId([], "Café Übersicht")).toBe("0001-cafe-ubersicht");
  });
});
