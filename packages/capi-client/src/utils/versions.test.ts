import { describe, expect, it } from "vitest";
import { createMemoryCacheProvider } from "./cache";
import {
  haveVersionsChanged,
  mergeVersions,
  readVersions,
  versionsKey,
  writeVersions,
} from "./versions";

describe("versionsKey", () => {
  it("should namespace the record per token id", () => {
    expect(versionsKey("tid-a")).toBe("sb:versions:v1:tid-a");
    expect(versionsKey("tid-a")).not.toBe(versionsKey("tid-b"));
  });
});

describe("mergeVersions", () => {
  it("should adopt both versions when nothing is known yet", () => {
    expect(mergeVersions(undefined, { knownCv: 1000, knownSpaceVersion: 1001 })).toEqual({
      knownCv: 1000,
      knownSpaceVersion: 1001,
      highestCv: 1000,
    });
  });

  it("should advance a version that moved forward", () => {
    expect(mergeVersions({ knownCv: 1000 }, { knownCv: 2000 })).toEqual({
      knownCv: 2000,
      knownSpaceVersion: undefined,
      highestCv: 2000,
    });
  });

  it("should ignore a version that moved backwards", () => {
    expect(
      mergeVersions(
        { knownCv: 2000, knownSpaceVersion: 2001 },
        { knownCv: 1000, knownSpaceVersion: 1001 },
      ),
    ).toEqual({ knownCv: 2000, knownSpaceVersion: 2001, highestCv: 2000 });
  });

  it("should keep a known version when the response reports none", () => {
    expect(mergeVersions({ knownCv: 1000, knownSpaceVersion: 1001 }, {})).toEqual({
      knownCv: 1000,
      knownSpaceVersion: 1001,
      highestCv: 1000,
    });
  });

  it("should advance each version independently", () => {
    expect(
      mergeVersions({ knownCv: 1000, knownSpaceVersion: 3000 }, { knownSpaceVersion: 4000 }),
    ).toEqual({
      knownCv: 1000,
      knownSpaceVersion: 4000,
      highestCv: 1000,
    });
  });

  it("should keep the highest cv when the known one was invalidated", () => {
    const invalidated = mergeVersions({ knownCv: 2000, highestCv: 2000 }, { knownCv: undefined });

    expect(mergeVersions({ ...invalidated, knownCv: undefined }, { knownCv: 1000 })).toEqual({
      knownCv: 1000,
      knownSpaceVersion: undefined,
      highestCv: 2000,
    });
  });
});

describe("haveVersionsChanged", () => {
  it("should report a change when nothing was recorded yet", () => {
    expect(haveVersionsChanged(undefined, {})).toBe(true);
  });

  it("should report no change for identical records", () => {
    expect(
      haveVersionsChanged(
        { knownCv: 1000, knownSpaceVersion: undefined },
        { knownCv: 1000, knownSpaceVersion: undefined },
      ),
    ).toBe(false);
  });

  it("should report a change when a version was dropped", () => {
    expect(
      haveVersionsChanged({ knownCv: 1000, knownSpaceVersion: 2000 }, { knownSpaceVersion: 2000 }),
    ).toBe(true);
  });
});

describe("readVersions / writeVersions", () => {
  it("should round-trip the record through a provider", async () => {
    const provider = createMemoryCacheProvider();
    const key = versionsKey("token");

    expect(await readVersions(provider, key)).toBeUndefined();

    await writeVersions(provider, key, { knownCv: 1000, knownSpaceVersion: 1001 });

    expect(await readVersions(provider, key)).toEqual({ knownCv: 1000, knownSpaceVersion: 1001 });
  });

  it("should record a cleared cv as a present record", async () => {
    const provider = createMemoryCacheProvider();
    const key = versionsKey("token");

    await writeVersions(provider, key, { knownSpaceVersion: 2000 });

    expect(await readVersions(provider, key)).toEqual({ knownSpaceVersion: 2000 });
  });
});
