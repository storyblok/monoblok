import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fileContentStore } from "./content-store";

async function storeWith(stories: { id: number; slug: string }[]) {
  const dir = await mkdtemp(path.join(tmpdir(), "fixtures-"));
  for (const story of stories) {
    await writeFile(
      path.join(dir, `${story.slug}.json`),
      JSON.stringify({ ...story, name: story.slug, content: { _uid: "r", component: "page" } }),
    );
  }
  return { dir, store: fileContentStore(dir) };
}

describe("fileContentStore", () => {
  it("should list every story in the directory, ordered by id", async () => {
    const { store } = await storeWith([
      { id: 2, slug: "about" },
      { id: 1, slug: "home" },
    ]);

    expect((await store.list()).map((story) => story.slug)).toEqual(["home", "about"]);
  });

  it("should list stories beside files that are not stories", async () => {
    const { dir, store } = await storeWith([{ id: 1, slug: "home" }]);
    await writeFile(path.join(dir, "README.md"), "not a story\n");

    expect((await store.list()).map((story) => story.slug)).toEqual(["home"]);
  });

  it("should round-trip a written story", async () => {
    const { store } = await storeWith([{ id: 1, slug: "home" }]);
    const story = await store.get(1);

    await store.put({ ...story, content: { _uid: "r", component: "page", title: "changed" } });

    expect((await store.get(1)).content).toMatchObject({ title: "changed" });
  });

  it("should leave the other stories alone when one is written", async () => {
    const { store } = await storeWith([
      { id: 1, slug: "home" },
      { id: 2, slug: "about" },
    ]);

    await store.put({ ...(await store.get(1)), content: { _uid: "r", component: "changed" } });

    expect((await store.get(2)).content).toMatchObject({ component: "page" });
  });

  it("should write stories back as indented JSON so a diff is reviewable", async () => {
    const { dir, store } = await storeWith([{ id: 1, slug: "home" }]);

    await store.put(await store.get(1));

    const written = await readFile(path.join(dir, "home.json"), "utf8");
    expect(written.split("\n").length).toBeGreaterThan(1);
    expect(written).toContain(`\n  "slug": "home"`);
    expect(written.endsWith("}\n")).toBe(true);
  });

  it("should reject a get for an id the directory does not hold", async () => {
    const { store } = await storeWith([{ id: 1, slug: "home" }]);

    await expect(store.get(404)).rejects.toThrow(/404/);
  });
});
