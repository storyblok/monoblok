import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { Journal, MigrationRun, StoryInverse } from "./journal";
import { localJournal, runId } from "./journal-local";

function run(overrides: Partial<MigrationRun> = {}): MigrationRun {
  return {
    id: "2026-01-01T00-00-00-000Z-0002-rename-meta-author",
    space: "12345",
    migration: "0002-rename-meta-author",
    title: "Rename spike_meta.author",
    appliedAt: "2026-01-01T00:00:00.000Z",
    stories: 1,
    blocks: 1,
    ...overrides,
  };
}

const inverse: StoryInverse[] = [
  {
    story: "777",
    patches: [
      {
        uid: "meta-1",
        component: "spike_meta",
        ops: [
          { kind: "unset", key: "written_by", expect: "Ada" },
          { kind: "set", key: "author", value: "Ada", expect: undefined },
        ],
      },
    ],
  },
];

describe("localJournal", () => {
  let journal: Journal;

  beforeEach(async () => {
    journal = localJournal(await mkdtemp(path.join(tmpdir(), "schema-journal-")));
  });

  it("should return a recorded run in a listing for its space", async () => {
    await journal.record(run(), inverse);
    expect(await journal.list("12345")).toEqual([run()]);
  });

  it("should not return a run recorded against a different space", async () => {
    await journal.record(run({ space: "99999" }), inverse);
    expect(await journal.list("12345")).toEqual([]);
  });

  it("should read back the inverse patches a run recorded", async () => {
    await journal.record(run(), inverse);
    expect(await journal.readInverse(run().id)).toEqual(inverse);
  });

  it("should report an unknown run as absent rather than throwing", async () => {
    expect(await journal.read("never-happened")).toBeUndefined();
    expect(await journal.readInverse("never-happened")).toEqual([]);
  });

  it("should list runs oldest first, so the latest is the one to roll back", async () => {
    await journal.record(run({ id: "2026-01-01-a", appliedAt: "2026-01-01T00:00:00.000Z" }), []);
    await journal.record(run({ id: "2026-02-01-b", appliedAt: "2026-02-01T00:00:00.000Z" }), []);
    const ids = (await journal.list("12345")).map((entry) => entry.id);
    expect(ids).toEqual(["2026-01-01-a", "2026-02-01-b"]);
  });

  it("should keep the same migration recorded twice as two distinct runs", async () => {
    await journal.record(run({ id: "run-a" }), inverse);
    await journal.record(run({ id: "run-b" }), inverse);
    expect((await journal.list("12345")).map((entry) => entry.migration)).toEqual([
      "0002-rename-meta-author",
      "0002-rename-meta-author",
    ]);
  });
});

describe("localJournal on disk", () => {
  it("should keep the patches out of the file a listing reads", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "schema-journal-"));
    await localJournal(root).record(run(), inverse);

    const entry = await readFile(path.join(root, "12345", `${run().id}.json`), "utf8");
    expect(JSON.parse(entry)).toEqual(run());
    expect(entry).not.toContain("written_by");
  });

  it("should write one entry file and one patch file per run", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "schema-journal-"));
    await localJournal(root).record(run(), inverse);
    expect((await readdir(path.join(root, "12345"))).sort()).toEqual([
      `${run().id}.json`,
      `${run().id}.patches.json`,
    ]);
  });
});

describe("runId", () => {
  it("should sort chronologically, so a listing needs no entry bodies to order runs", () => {
    const earlier = runId("0001-first", new Date("2026-01-01T00:00:00Z"));
    const later = runId("0002-second", new Date("2026-02-01T00:00:00Z"));
    expect([later, earlier].sort()).toEqual([earlier, later]);
  });

  it("should carry the migration id, so a run is identifiable without a lookup", () => {
    expect(runId("0002-rename-meta-author", new Date("2026-01-01T00:00:00Z"))).toContain(
      "0002-rename-meta-author",
    );
  });
});
