import { randomUUID } from "node:crypto";
import { join } from "pathe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { vol } from "memfs";
import type { Story } from "@storyblok/management-api-client/resources/stories";
import {
  createStoriesForLevel,
  groupStoriesByDepth,
  readLocalStoriesStream,
  scanLocalStoryIndex,
} from "./streams";
import type { ExistingTargetStories, StoryIndexEntry } from "./constants";
import { normalizeFullSlug } from "./constants";
import type { RefMaps } from "./ref-mapper";
import * as actions from "./actions";

const STORIES_DIR = "/tmp/stories";

const writeStory = (story: Record<string, unknown>) => {
  const filePath = join(STORIES_DIR, `${story.slug}_${story.uuid}.json`);
  vol.fromJSON({ [filePath]: JSON.stringify(story) });
};

const collectStream = async (stream: ReturnType<typeof readLocalStoriesStream>): Promise<any[]> => {
  const results: any[] = [];
  for await (const story of stream) {
    results.push(story);
  }
  return results;
};

describe("readLocalStoriesStream", () => {
  it("should yield all stories from the directory", async () => {
    const storyA = {
      name: "Story A",
      id: 100,
      uuid: randomUUID(),
      parent_id: 0,
      is_folder: false,
      slug: "story-a",
    };
    const storyB = {
      name: "Story B",
      id: 200,
      uuid: randomUUID(),
      parent_id: 100,
      is_folder: false,
      slug: "story-b",
    };
    writeStory(storyA);
    writeStory(storyB);

    const stream = readLocalStoriesStream({ directoryPath: STORIES_DIR });
    const results = await collectStream(stream);

    expect(results).toHaveLength(2);
    expect(results.map((s) => s.id)).toEqual(expect.arrayContaining([100, 200]));
  });

  it("should report errors for invalid JSON files without stopping", async () => {
    const validStory = {
      name: "Valid",
      id: 1,
      uuid: randomUUID(),
      parent_id: 0,
      is_folder: false,
      slug: "valid",
    };
    writeStory(validStory);
    vol.fromJSON({ [join(STORIES_DIR, "bad_file.json")]: "{invalid json" });

    const errors: string[] = [];
    const stream = readLocalStoriesStream({
      directoryPath: STORIES_DIR,
      onStoryError(_error, filename) {
        errors.push(filename);
      },
    });
    const results = await collectStream(stream);

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(1);
    expect(errors).toHaveLength(1);
  });

  it("should yield a story whose uuid contains underscores when its filename passes the filter", async () => {
    const uuidWithUnderscore = "legacy_id_123";
    const storyA = {
      name: "Story A",
      id: 100,
      uuid: uuidWithUnderscore,
      parent_id: 0,
      is_folder: false,
      slug: "story-a",
      content: { _uid: "x", component: "page", title: "real content" },
    };
    writeStory(storyA);

    const stream = readLocalStoriesStream({
      directoryPath: STORIES_DIR,
      fileFilter: () => true,
    });
    const results = await collectStream(stream);

    expect(results).toHaveLength(1);
    expect(results[0].uuid).toBe(uuidWithUnderscore);
    expect(results[0].content.title).toBe("real content");
  });

  it("should not read files rejected by fileFilter", async () => {
    const keepUuid = randomUUID();
    const dropUuid = randomUUID();
    writeStory({
      name: "Keep",
      id: 1,
      uuid: keepUuid,
      parent_id: 0,
      is_folder: false,
      slug: "keep",
    });
    writeStory({
      name: "Drop",
      id: 2,
      uuid: dropUuid,
      parent_id: 0,
      is_folder: false,
      slug: "drop",
    });
    // Overwrite the "drop" file with invalid JSON; if the filter works,
    // the stream must never attempt to parse it.
    vol.fromJSON({ [join(STORIES_DIR, `drop_${dropUuid}.json`)]: "{not json" });

    const errors: string[] = [];
    const stream = readLocalStoriesStream({
      directoryPath: STORIES_DIR,
      fileFilter: ({ filename }) => filename.startsWith("keep_"),
      onStoryError: (_err, filename) => {
        errors.push(filename);
      },
    });
    const results = await collectStream(stream);

    expect(results).toHaveLength(1);
    expect(results[0].uuid).toBe(keepUuid);
    expect(errors).toEqual([]);
  });
});

describe("normalizeFullSlug", () => {
  it("should strip trailing slash", () => {
    expect(normalizeFullSlug("blog/")).toBe("blog");
  });

  it("should leave slugs without trailing slash unchanged", () => {
    expect(normalizeFullSlug("blog/post-1")).toBe("blog/post-1");
  });

  it("should handle empty string", () => {
    expect(normalizeFullSlug("")).toBe("");
  });
});

describe("scanLocalStoryIndex", () => {
  it("should read story files into index entries", async () => {
    const uuid = randomUUID();
    writeStory({
      id: 10,
      uuid,
      slug: "about",
      name: "About",
      full_slug: "about",
      is_folder: false,
      parent_id: 0,
      content: { _uid: "1", component: "page" },
    });

    const entries = await scanLocalStoryIndex({ directoryPath: STORIES_DIR });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: 10,
      uuid,
      slug: "about",
      name: "About",
      full_slug: "about",
      is_folder: false,
      is_startpage: false,
      parent_id: 0,
      component: "page",
    });
    expect(entries[0].filename).toMatch(/\.json$/);
  });

  it("should extract is_startpage from story data", async () => {
    writeStory({
      id: 20,
      uuid: randomUUID(),
      slug: "home",
      name: "Home",
      full_slug: "blog/home",
      is_folder: false,
      is_startpage: true,
      parent_id: 5,
      content: { _uid: "1", component: "page" },
    });

    const entries = await scanLocalStoryIndex({ directoryPath: STORIES_DIR });

    expect(entries).toHaveLength(1);
    expect(entries[0].is_startpage).toBe(true);
    expect(entries[0].parent_id).toBe(5);
  });

  it("should report errors for invalid JSON and continue", async () => {
    writeStory({
      id: 30,
      uuid: randomUUID(),
      slug: "valid",
      name: "Valid",
      full_slug: "valid",
      is_folder: false,
      parent_id: 0,
      content: { _uid: "1", component: "page" },
    });
    vol.fromJSON({ [join(STORIES_DIR, "broken.json")]: "{bad" });

    const errors: string[] = [];
    const entries = await scanLocalStoryIndex({
      directoryPath: STORIES_DIR,
      onError(_err, filename) {
        errors.push(filename);
      },
    });

    expect(entries).toHaveLength(1);
    expect(entries[0].slug).toBe("valid");
    expect(errors).toEqual(["broken.json"]);
  });

  it("should skip non-JSON files", async () => {
    writeStory({
      id: 40,
      uuid: randomUUID(),
      slug: "story",
      name: "Story",
      full_slug: "story",
      is_folder: false,
      parent_id: 0,
      content: { _uid: "1", component: "page" },
    });
    vol.fromJSON({ [join(STORIES_DIR, "readme.txt")]: "not a story" });

    const entries = await scanLocalStoryIndex({ directoryPath: STORIES_DIR });

    expect(entries).toHaveLength(1);
  });

  it("should report an error for stories missing a uuid", async () => {
    // Story JSON with no `uuid` field — multiple such stories would otherwise
    // collide on an empty-string key when the push command builds its maps.
    vol.fromJSON({
      [join(STORIES_DIR, "no-uuid_unknown.json")]: JSON.stringify({
        id: 50,
        slug: "no-uuid",
        name: "No UUID",
        full_slug: "no-uuid",
        is_folder: false,
        parent_id: 0,
        content: { _uid: "1", component: "page" },
      }),
    });

    const errors: Array<{ filename: string; message: string }> = [];
    const entries = await scanLocalStoryIndex({
      directoryPath: STORIES_DIR,
      onError(error, filename) {
        errors.push({ filename, message: error.message });
      },
    });

    expect(entries).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].filename).toBe("no-uuid_unknown.json");
    expect(errors[0].message).toMatch(/uuid/i);
  });
});

describe("groupStoriesByDepth", () => {
  const makeEntry = (overrides: Partial<StoryIndexEntry> = {}): StoryIndexEntry => ({
    filename: "test.json",
    id: Math.floor(Math.random() * 10000),
    uuid: randomUUID(),
    slug: "test",
    name: "Test",
    full_slug: "test",
    is_folder: false,
    is_startpage: false,
    parent_id: 0,
    component: "page",
    ...overrides,
  });

  it("should group stories by slug depth", () => {
    const root = makeEntry({ full_slug: "home" });
    const child = makeEntry({ full_slug: "blog/post-1" });
    const grandchild = makeEntry({ full_slug: "blog/2024/post-2" });

    const levels = groupStoriesByDepth([grandchild, root, child]);

    expect(levels).toHaveLength(3);
    expect(levels[0]).toEqual([root]);
    expect(levels[1]).toEqual([child]);
    expect(levels[2]).toEqual([grandchild]);
  });

  it("should sort folders before stories within a level", () => {
    const story = makeEntry({ full_slug: "about", is_folder: false });
    const folder = makeEntry({ full_slug: "blog", is_folder: true });

    const levels = groupStoriesByDepth([story, folder]);

    expect(levels).toHaveLength(1);
    expect(levels[0][0].is_folder).toBe(true);
    expect(levels[0][1].is_folder).toBe(false);
  });

  it("should handle trailing slashes via normalizeFullSlug", () => {
    const entry = makeEntry({ full_slug: "blog/" });

    const levels = groupStoriesByDepth([entry]);

    // "blog/" normalizes to "blog" -> depth 0
    expect(levels).toHaveLength(1);
    expect(levels[0]).toEqual([entry]);
  });

  it("should return empty array for empty input", () => {
    const levels = groupStoriesByDepth([]);
    expect(levels).toEqual([]);
  });

  it("should skip empty depth levels", () => {
    // depth 0 and depth 2 only (no depth 1)
    const root = makeEntry({ full_slug: "home" });
    const deep = makeEntry({ full_slug: "a/b/c" });

    const levels = groupStoriesByDepth([root, deep]);

    expect(levels).toHaveLength(2);
    expect(levels[0]).toEqual([root]);
    expect(levels[1]).toEqual([deep]);
  });
});

const mockCreateStory = vi.spyOn(actions, "createStory");

describe("createStoriesForLevel", () => {
  const SPACE_ID = "12345";
  let remoteIdCounter = 9000;

  const noopManifest = vi.fn().mockResolvedValue(undefined);

  afterEach(() => {
    mockCreateStory.mockReset();
    noopManifest.mockClear();
    remoteIdCounter = 9000;
  });

  const fakeCreate = () =>
    mockCreateStory.mockImplementation(
      async (_spaceId, payload) =>
        ({
          id: ++remoteIdCounter,
          uuid: randomUUID(),
          slug: payload.story.slug,
          name: payload.story.name,
        }) as Story,
    );

  const makeEntry = (overrides: Partial<StoryIndexEntry> = {}): StoryIndexEntry => ({
    filename: "test.json",
    id: Math.floor(Math.random() * 10000),
    uuid: randomUUID(),
    slug: "test",
    name: "Test",
    full_slug: "test",
    is_folder: false,
    is_startpage: false,
    parent_id: 0,
    component: "page",
    ...overrides,
  });

  const emptyTargetStories = (): ExistingTargetStories => ({
    bySlug: new Map(),
    byId: new Map(),
  });

  const emptyMaps = (): RefMaps => ({
    stories: new Map(),
  });

  describe("skip logic", () => {
    it("should skip stories already in the manifest map", async () => {
      const entry = makeEntry({ id: 100 });
      const maps = emptyMaps();
      maps.stories!.set(100, 500);
      const targetStories = emptyTargetStories();
      targetStories.byId.set(500, { id: 500, uuid: randomUUID() });

      const skipped: StoryIndexEntry[] = [];
      await createStoriesForLevel({
        level: [entry],
        spaceId: SPACE_ID,
        maps,
        existingTargetStories: targetStories,
        isCrossSpace: false,
        claimedRemoteIds: new Set(),
        dryRun: false,
        appendToManifest: noopManifest,
        onStorySkipped(e) {
          skipped.push(e);
        },
      });

      expect(skipped).toHaveLength(1);
      expect(skipped[0].id).toBe(100);
      expect(mockCreateStory).not.toHaveBeenCalled();
    });

    it("should skip by full_slug in cross-space push (UUIDs always differ)", async () => {
      const entry = makeEntry({ full_slug: "blog/post-1" });
      const targetStories = emptyTargetStories();
      targetStories.bySlug.set("blog/post-1", [{ id: 200, uuid: randomUUID() }]);

      const skipped: StoryIndexEntry[] = [];
      const manifest = vi.fn().mockResolvedValue(undefined);
      await createStoriesForLevel({
        level: [entry],
        spaceId: SPACE_ID,
        maps: emptyMaps(),
        existingTargetStories: targetStories,
        isCrossSpace: true,
        claimedRemoteIds: new Set(),
        dryRun: false,
        appendToManifest: manifest,
        onStorySkipped(e) {
          skipped.push(e);
        },
      });

      expect(skipped).toHaveLength(1);
      expect(manifest).toHaveBeenCalledOnce();
      expect(mockCreateStory).not.toHaveBeenCalled();
    });

    it("should not slug-match a remote story already claimed by another entry", async () => {
      // Simulates a slug-swap: entry-a was previously pushed to remote-500.
      // A new entry-b now has the same slug. Without claimed tracking,
      // both would map to remote-500 causing data loss.
      const entryB = makeEntry({ full_slug: "about", component: "page" });
      const targetStories = emptyTargetStories();
      targetStories.bySlug.set("about", [{ id: 500, uuid: randomUUID() }]);

      // remote-500 was already claimed (e.g. by entry-a via manifest in a prior level)
      const claimed = new Set([500]);
      fakeCreate();

      const successes: StoryIndexEntry[] = [];
      await createStoriesForLevel({
        level: [entryB],
        spaceId: SPACE_ID,
        maps: emptyMaps(),
        existingTargetStories: targetStories,
        claimedRemoteIds: claimed,
        isCrossSpace: true,
        dryRun: false,
        appendToManifest: noopManifest,
        onStorySuccess(e) {
          successes.push(e);
        },
      });

      // Should create a new remote story instead of mapping to claimed remote-500
      expect(successes).toHaveLength(1);
      expect(mockCreateStory).toHaveBeenCalledOnce();
    });

    it("should claim remote IDs from both manifest and slug matches", async () => {
      // Two entries: one matched via manifest, one via slug.
      // Both should claim their remote IDs so no future entry can re-use them.
      const manifestEntry = makeEntry({ id: 100, full_slug: "old" });
      const slugEntry = makeEntry({ full_slug: "about" });
      const maps = emptyMaps();
      maps.stories!.set(100, 500);
      const targetStories = emptyTargetStories();
      targetStories.byId.set(500, { id: 500, uuid: randomUUID() });
      targetStories.bySlug.set("about", [{ id: 600, uuid: randomUUID() }]);

      const claimed = new Set<number>();
      await createStoriesForLevel({
        level: [manifestEntry, slugEntry],
        spaceId: SPACE_ID,
        maps,
        existingTargetStories: targetStories,
        claimedRemoteIds: claimed,
        isCrossSpace: true,
        dryRun: false,
        appendToManifest: noopManifest,
        onStorySkipped() {},
      });

      expect(claimed).toContain(500);
      expect(claimed).toContain(600);
      expect(mockCreateStory).not.toHaveBeenCalled();
    });

    it("should match folder and startpage separately when they share the same full_slug", async () => {
      const folder = makeEntry({ full_slug: "de-de", is_folder: true, component: undefined });
      const startpage = makeEntry({
        full_slug: "de-de",
        is_folder: false,
        is_startpage: true,
        component: "page",
      });
      const targetStories = emptyTargetStories();
      const folderRef = { id: 300, uuid: randomUUID(), is_folder: true };
      const startpageRef = { id: 301, uuid: randomUUID(), is_folder: false };
      targetStories.bySlug.set("de-de", [folderRef, startpageRef]);

      const skipped: StoryIndexEntry[] = [];
      await createStoriesForLevel({
        level: [folder, startpage],
        spaceId: SPACE_ID,
        maps: emptyMaps(),
        existingTargetStories: targetStories,
        isCrossSpace: true,
        claimedRemoteIds: new Set(),
        dryRun: false,
        appendToManifest: noopManifest,
        onStorySkipped(e) {
          skipped.push(e);
        },
      });

      expect(skipped).toHaveLength(2);
      expect(mockCreateStory).not.toHaveBeenCalled();
      // Verify folder matched the folder ref and startpage matched the startpage ref
      expect(noopManifest).toHaveBeenCalledWith(folder, folderRef);
      expect(noopManifest).toHaveBeenCalledWith(startpage, startpageRef);
    });

    it("should not skip by slug in same-space push when UUID differs", async () => {
      const entry = makeEntry({ full_slug: "about", component: "page" });
      const targetStories = emptyTargetStories();
      targetStories.bySlug.set("about", [{ id: 200, uuid: randomUUID() }]);
      fakeCreate();

      const successes: StoryIndexEntry[] = [];
      await createStoriesForLevel({
        level: [entry],
        spaceId: SPACE_ID,
        maps: emptyMaps(),
        existingTargetStories: targetStories,
        isCrossSpace: false,
        claimedRemoteIds: new Set(),
        dryRun: false,
        appendToManifest: noopManifest,
        onStorySuccess(e) {
          successes.push(e);
        },
      });

      expect(successes).toHaveLength(1);
    });
  });

  describe("validation", () => {
    it("should error when a non-folder story has no component", async () => {
      const entry = makeEntry({ slug: "broken", is_folder: false, component: undefined });

      const errors: Error[] = [];
      await createStoriesForLevel({
        level: [entry],
        spaceId: SPACE_ID,
        maps: emptyMaps(),
        existingTargetStories: emptyTargetStories(),
        isCrossSpace: false,
        claimedRemoteIds: new Set(),
        dryRun: false,
        appendToManifest: noopManifest,
        onStoryError(error) {
          errors.push(error);
        },
      });

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("missing a content type");
      expect(mockCreateStory).not.toHaveBeenCalled();
    });
  });

  describe("dry-run", () => {
    it("should use fake response in dry-run mode without calling the API", async () => {
      const entry = makeEntry({ id: 100, uuid: "dry-uuid", component: "page" });

      const successes: Story[] = [];
      await createStoriesForLevel({
        level: [entry],
        spaceId: SPACE_ID,
        maps: emptyMaps(),
        existingTargetStories: emptyTargetStories(),
        isCrossSpace: false,
        dryRun: true,
        appendToManifest: noopManifest,
        onStorySuccess(_e, remote) {
          successes.push(remote);
        },
      });

      expect(successes).toHaveLength(1);
      expect(successes[0].id).toBe(100);
      expect(successes[0].uuid).toBe("dry-uuid");
      expect(mockCreateStory).not.toHaveBeenCalled();
      expect(noopManifest).not.toHaveBeenCalled();
    });
  });

  describe("creation payload", () => {
    it("should send parent_id and is_startpage when parent is resolved", async () => {
      const entry = makeEntry({
        slug: "home",
        parent_id: 50,
        is_startpage: true,
        component: "page",
      });
      const maps = emptyMaps();
      maps.stories!.set(50, 999);
      fakeCreate();

      await createStoriesForLevel({
        level: [entry],
        spaceId: SPACE_ID,
        maps,
        existingTargetStories: emptyTargetStories(),
        isCrossSpace: false,
        claimedRemoteIds: new Set(),
        dryRun: false,
        appendToManifest: noopManifest,
        onStorySuccess() {},
      });

      const payload = mockCreateStory.mock.calls[0][1];
      expect(payload.story.parent_id).toBe(999);
      expect(payload.story.is_startpage).toBe(true);
    });

    it("should omit parent_id and is_startpage when parent is not yet resolved", async () => {
      const entry = makeEntry({
        slug: "orphan",
        parent_id: 50,
        is_startpage: true,
        component: "page",
      });
      fakeCreate();

      await createStoriesForLevel({
        level: [entry],
        spaceId: SPACE_ID,
        maps: emptyMaps(),
        existingTargetStories: emptyTargetStories(),
        isCrossSpace: false,
        claimedRemoteIds: new Set(),
        dryRun: false,
        appendToManifest: noopManifest,
        onStorySuccess() {},
      });

      const payload = mockCreateStory.mock.calls[0][1];
      expect(payload.story).not.toHaveProperty("parent_id");
      expect(payload.story).not.toHaveProperty("is_startpage");
    });

    it("should send content placeholder for stories and omit it for folders", async () => {
      const folder = makeEntry({ slug: "blog", is_folder: true, component: undefined });
      const story = makeEntry({ slug: "post", is_folder: false, component: "page" });
      fakeCreate();

      await createStoriesForLevel({
        level: [folder, story],
        spaceId: SPACE_ID,
        maps: emptyMaps(),
        existingTargetStories: emptyTargetStories(),
        isCrossSpace: false,
        claimedRemoteIds: new Set(),
        dryRun: false,
        appendToManifest: noopManifest,
        onStorySuccess() {},
      });

      const folderPayload = mockCreateStory.mock.calls.find((c) => c[1].story.slug === "blog")![1];
      const storyPayload = mockCreateStory.mock.calls.find((c) => c[1].story.slug === "post")![1];
      expect(folderPayload.story).not.toHaveProperty("content");
      expect(storyPayload.story.content).toEqual({ _uid: "", component: "page" });
    });
  });
});

describe("push pipeline: scan -> group -> create level-by-level", () => {
  let remoteIdCounter = 9000;
  const SPACE_ID = "12345";

  afterEach(() => {
    mockCreateStory.mockReset();
    remoteIdCounter = 9000;
  });

  const fakeCreate = () =>
    mockCreateStory.mockImplementation(
      async (_spaceId, payload) =>
        ({
          id: ++remoteIdCounter,
          uuid: randomUUID(),
          slug: payload.story.slug,
          name: payload.story.name,
        }) as Story,
    );

  it("should create a nested tree with correct parent_id and is_startpage", async () => {
    // Tree:
    //   blog/            (folder, depth 0)
    //   blog/home        (startpage of blog, depth 1)
    //   blog/post-1      (story, depth 1)
    //   blog/2024/        (subfolder, depth 1)
    //   blog/2024/recap  (story, depth 2)
    const blogId = 1;
    const subId = 4;
    writeStory({
      id: blogId,
      uuid: randomUUID(),
      slug: "blog",
      name: "Blog",
      full_slug: "blog",
      is_folder: true,
      parent_id: 0,
    });
    writeStory({
      id: 2,
      uuid: randomUUID(),
      slug: "home",
      name: "Home",
      full_slug: "blog/home",
      is_folder: false,
      is_startpage: true,
      parent_id: blogId,
      content: { _uid: "1", component: "page" },
    });
    writeStory({
      id: 3,
      uuid: randomUUID(),
      slug: "post-1",
      name: "Post 1",
      full_slug: "blog/post-1",
      is_folder: false,
      parent_id: blogId,
      content: { _uid: "2", component: "page" },
    });
    writeStory({
      id: subId,
      uuid: randomUUID(),
      slug: "2024",
      name: "2024",
      full_slug: "blog/2024",
      is_folder: true,
      parent_id: blogId,
    });
    writeStory({
      id: 5,
      uuid: randomUUID(),
      slug: "recap",
      name: "Recap",
      full_slug: "blog/2024/recap",
      is_folder: false,
      parent_id: subId,
      content: { _uid: "3", component: "page" },
    });

    fakeCreate();

    // Phase 1: scan files from disk
    const index = await scanLocalStoryIndex({ directoryPath: STORIES_DIR });
    expect(index).toHaveLength(5);

    // Phase 2: group by depth
    const levels = groupStoriesByDepth(index);
    expect(levels).toHaveLength(3); // depth 0, 1, 2

    // Depth 0 should contain only the blog folder
    expect(levels[0]).toHaveLength(1);
    expect(levels[0][0].slug).toBe("blog");

    // Depth 1: folder "2024" should come before non-folders
    const depth1Slugs = levels[1].map((e) => e.slug);
    expect(depth1Slugs).toContain("2024");
    expect(depth1Slugs).toContain("home");
    expect(depth1Slugs).toContain("post-1");
    expect(levels[1][0].is_folder).toBe(true); // "2024" folder sorted first

    // Phase 3: create level-by-level, populating maps as we go
    const maps: RefMaps = { stories: new Map() };
    const noopManifest = vi.fn().mockResolvedValue(undefined);

    for (const level of levels) {
      await createStoriesForLevel({
        level,
        spaceId: SPACE_ID,
        maps,
        existingTargetStories: { bySlug: new Map(), byId: new Map() },
        isCrossSpace: false,
        claimedRemoteIds: new Set(),
        dryRun: false,
        appendToManifest: noopManifest,
        onStorySuccess(entry, remoteStory) {
          maps.stories!.set(entry.id, remoteStory.id);
          maps.stories!.set(entry.uuid, remoteStory.uuid!);
        },
      });
    }

    // All 5 stories should have been created
    expect(mockCreateStory).toHaveBeenCalledTimes(5);

    // Collect all payloads by slug for assertion
    const payloadBySlug = new Map<string, Record<string, unknown>>();
    for (const call of mockCreateStory.mock.calls) {
      const story = call[1].story as Record<string, unknown>;
      payloadBySlug.set(story.slug as string, story);
    }

    // Blog folder: root-level, no parent_id
    const blogPayload = payloadBySlug.get("blog")!;
    expect(blogPayload.is_folder).toBe(true);
    expect(blogPayload).not.toHaveProperty("parent_id");
    expect(blogPayload).not.toHaveProperty("content");

    // Home: startpage of blog, should have parent_id and is_startpage
    const blogRemoteId = maps.stories!.get(blogId);
    const homePayload = payloadBySlug.get("home")!;
    expect(homePayload.parent_id).toBe(Number(blogRemoteId));
    expect(homePayload.is_startpage).toBe(true);

    // Post-1: child of blog, has parent_id but NOT is_startpage
    const postPayload = payloadBySlug.get("post-1")!;
    expect(postPayload.parent_id).toBe(Number(blogRemoteId));
    expect(postPayload).not.toHaveProperty("is_startpage");

    // 2024 subfolder: child of blog
    const subPayload = payloadBySlug.get("2024")!;
    expect(subPayload.parent_id).toBe(Number(blogRemoteId));
    expect(subPayload.is_folder).toBe(true);

    // Recap: child of 2024 subfolder (depth 2)
    const subRemoteId = maps.stories!.get(subId);
    const recapPayload = payloadBySlug.get("recap")!;
    expect(recapPayload.parent_id).toBe(Number(subRemoteId));

    // Manifest should have been written for all 5 stories
    expect(noopManifest).toHaveBeenCalledTimes(5);
  });
});
