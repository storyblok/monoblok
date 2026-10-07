import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { discoverMigrations, loadMigrations } from "./load-migrations";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__");
const spaceMigrations = path.join(fixtures, "space-migrations");

const importDefault = async (file: string): Promise<unknown> => (await import(file)).default;

describe("loadMigrations", () => {
  it("should return migrations in filename order however the directory lists them", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "schema-migrations-"));
    // Written newest first, so creation order disagrees with run order.
    await writeFile(path.join(directory, "0010-later.ts"), "");
    await writeFile(path.join(directory, "0002-earlier.ts"), "");

    const discovered = await discoverMigrations(directory);

    expect(discovered.map((entry) => entry.id)).toEqual(["0002-earlier", "0010-later"]);
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

    expect(loaded.map((entry) => entry.file)).toEqual([
      path.join(spaceMigrations, "0001-rename-card-title.ts"),
      path.join(spaceMigrations, "0002-drop-card-subtitle.ts"),
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
