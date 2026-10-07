import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { getLocalDatasources, updateLocalDatasource } from "./local-datasources";

const FIXTURES_DIR = new URL("__test__/fixtures/.storyblok/datasources/12345", import.meta.url)
  .pathname;

describe("getLocalDatasources", () => {
  it("should return all datasources from directory", async () => {
    const datasources = await getLocalDatasources(FIXTURES_DIR);
    expect(datasources).toHaveLength(2);
  });

  it("should return datasource objects with correct shape", async () => {
    const datasources = await getLocalDatasources(FIXTURES_DIR);
    const colors = datasources.find((d) => d.slug === "colors");
    expect(colors).toBeDefined();
    expect(colors?.name).toBe("Colors");
  });

  it("should return empty array for empty directory", async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), "sb-datasources-empty-"));
    const datasources = await getLocalDatasources(emptyDir);
    expect(datasources).toEqual([]);
    await rm(emptyDir, { recursive: true });
  });

  it("should filter to only .json files", async () => {
    const datasources = await getLocalDatasources(FIXTURES_DIR);
    for (const ds of datasources) {
      expect(ds).toHaveProperty("id");
      expect(ds).toHaveProperty("slug");
    }
  });
});

describe("updateLocalDatasource", () => {
  let TEST_DIR: string;

  beforeEach(async () => {
    TEST_DIR = await mkdtemp(join(tmpdir(), "sb-datasources-write-"));
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it("should write datasource as {name}.json", async () => {
    const datasource = {
      id: 99,
      name: "Test DS",
      slug: "test-ds",
      dimensions: [],
    };
    await updateLocalDatasource(TEST_DIR, datasource as any);
    const filePath = join(TEST_DIR, "Test DS.json");
    const content = await readFile(filePath, "utf8");
    const parsed = JSON.parse(content);
    expect(parsed.slug).toBe("test-ds");
    expect(parsed.id).toBe(99);
  });

  it("should overwrite the file pulled by the CLI instead of writing a duplicate", async () => {
    const pulledFilename = "Country _ Currency.json";
    const datasource = { id: 4, name: "Country / Currency", slug: "country-currency" };
    await writeFile(join(TEST_DIR, pulledFilename), JSON.stringify(datasource));

    await updateLocalDatasource(TEST_DIR, { ...datasource, slug: "updated" } as any);

    expect(await readdir(TEST_DIR)).toEqual([pulledFilename]);
    const datasources = await getLocalDatasources(TEST_DIR);
    expect(datasources[0].slug).toBe("updated");
  });

  it("should round-trip: write → read matches", async () => {
    const datasource = {
      id: 1,
      name: "Colors",
      slug: "colors",
      dimensions: [],
    };
    await updateLocalDatasource(TEST_DIR, datasource as any);
    const datasources = await getLocalDatasources(TEST_DIR);
    expect(datasources).toHaveLength(1);
    expect(datasources[0].slug).toBe("colors");
  });
});
