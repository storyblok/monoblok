import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolve } from "pathe";
import { vol } from "memfs";
// Import the main module first to ensure proper initialization
import "../index";
import { migrationsCommand } from "../command";
import { fetchStories, fetchStory, updateStory } from "../../stories/actions";
import type { Story } from "../../stories/constants";
import * as filesystem from "../../../utils/filesystem";
import { resetLogger } from "../../../lib/logger/logger";
import { resetReporter } from "../../../lib/reporter/reporter";
import { getLogFileContents } from "../../__tests__/helpers";
import { buildMigrationFilename } from "../migration-filename";
import { APIError } from "../../../utils/error";
import { FetchError } from "../../../utils/fetch";

vi.mock("../../stories/actions", () => ({
  fetchStories: vi.fn(),
  fetchStory: vi.fn(),
  updateStory: vi.fn(),
}));

vi.spyOn(console, "error");
vi.spyOn(console, "warn");

// Helper function to create mock story
const createMockStory = (overrides: Partial<Story> = {}): Story => {
  const { parent_id = 0, ...storyOverrides } = overrides;

  return {
    id: 517473243,
    name: "Test Story",
    uuid: "uuid-1",
    slug: "test-story",
    full_slug: "test-story",
    content: {
      _uid: "4b16d1ea-4306-47c5-b901-9d67d5babf53",
      component: "page",
      body: [
        {
          _uid: "216ba4ef-1298-4b7d-8ce0-7487e6db15cc",
          component: "migration-component",
          unchanged: "unchanged",
          amount: 10,
        },
      ],
    },
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2023-01-01T00:00:00Z",
    published_at: "2023-01-01T00:00:00Z",
    first_published_at: "2023-01-01T00:00:00Z",
    published: true,
    unpublished_changes: false,
    is_startpage: false,
    is_folder: false,
    pinned: false,
    parent_id,
    group_id: "group-1",
    parent: null,
    path: null,
    position: 0,
    sort_by_date: null,
    tag_list: [],
    disble_fe_editor: false,
    disable_fe_editor: false,
    default_root: null,
    preview_token: {
      token: "preview-token",
      timestamp: "2023-01-01T00:00:00Z",
    },
    meta_data: null,
    last_author: null,
    last_author_id: null,
    alternates: [],
    translated_slugs: [],
    localized_paths: [],
    breadcrumbs: [],
    publish_at: null,
    expire_at: null,
    user_ids: [],
    space_role_ids: [],
    translated_stories: [],
    can_not_view: null,
    is_scheduled: null,
    scheduled_dates: null,
    ideas: [],
    favourite_for_user_ids: [],
    imported_at: null,
    deleted_at: null,
    ...storyOverrides,
  };
};

const mockStory = createMockStory();
const unfetchableStory = createMockStory({ id: 517473244, name: "Unfetchable Story" });
const unpublishableStory = createMockStory({ id: 517473245, name: "Unpublishable Story" });
const WORKFLOW_STAGE_ERROR =
  "You are not allowed to publish at this workflow stage. Please change the workflow stage first.";

const UNSAFE_COMPONENT_NAME = "hero:v2";
const COLLIDING_COMPONENT_NAME = "hero_v2";
const COLLIDING_NAME_BLOCK = Object.freeze({
  _uid: "6a0b6d3e-0d5e-4a1a-8a2f-6f2c5b1d7a90",
  component: COLLIDING_COMPONENT_NAME,
  unchanged: "unchanged",
});
const UNSAFE_NAME_STORY = createMockStory({
  content: {
    _uid: "4b16d1ea-4306-47c5-b901-9d67d5babf53",
    component: "page",
    body: [
      {
        _uid: "216ba4ef-1298-4b7d-8ce0-7487e6db15cc",
        component: UNSAFE_COMPONENT_NAME,
        unchanged: "unchanged",
      },
      COLLIDING_NAME_BLOCK,
    ],
  },
});

const MIGRATION_FUNCTION_FILE_PATH = "./.storyblok/migrations/12345/migration-component.js";
const FROM_SPACE_MIGRATION_FILE_PATH = "./.storyblok/migrations/67890/migration-component.js";
const LOG_PREFIX = "storyblok-migrations-run-";

const preconditions = {
  canFetchStories() {
    vi.mocked(fetchStories).mockResolvedValue({
      stories: [mockStory],
      headers: new Headers({
        Total: "1",
        "Per-Page": "100",
      }),
    });
  },
  canFetchStory() {
    vi.mocked(fetchStory).mockResolvedValue(mockStory);
  },
  canUpdateStory() {
    vi.mocked(updateStory).mockResolvedValue(mockStory);
  },
  canLoadMigrationFunction(mockMigrationFn = (block: any) => ({ ...block, migrated: true })) {
    vol.fromJSON({
      [MIGRATION_FUNCTION_FILE_PATH]: "only the filename matters!",
    });
    const importModuleSpy = vi.spyOn(filesystem, "importModule");
    importModuleSpy.mockImplementation(() => Promise.resolve({ default: mockMigrationFn }));
  },
  canNotLoadMigrationFunction() {
    this.canFetchStories();
    this.canFetchStory();
    vol.fromJSON({
      [MIGRATION_FUNCTION_FILE_PATH]: "only the filename matters!",
    });
    vi.doMock(resolve(MIGRATION_FUNCTION_FILE_PATH), () => {
      throw new Error("Cannot find module");
    });
  },
  migrationDirectoryDoesNotExist() {
    vol.reset();
  },
  canMigrate() {
    this.canFetchStories();
    this.canFetchStory();
    this.canUpdateStory();
    this.canLoadMigrationFunction();
  },
  canMigrateNoChange() {
    this.canFetchStories();
    this.canFetchStory();
    this.canUpdateStory();
    this.canLoadMigrationFunction((block: any) => block);
  },
  canMigrateComponentWithUnsafeName() {
    vi.mocked(fetchStories).mockResolvedValue({
      stories: [UNSAFE_NAME_STORY],
      headers: new Headers({ Total: "1", "Per-Page": "100" }),
    });
    vi.mocked(fetchStory).mockResolvedValue(UNSAFE_NAME_STORY);
    this.canUpdateStory();
    vol.fromJSON({
      [`./.storyblok/migrations/12345/${buildMigrationFilename(UNSAFE_COMPONENT_NAME)}`]:
        "only the filename matters!",
    });
    vi.spyOn(filesystem, "importModule").mockImplementation(() =>
      Promise.resolve({ default: (block: any) => ({ ...block, migrated: true }) }),
    );
  },
  canMigrateComponentWithLegacyFilename() {
    // Versions before file names were sanitized wrote the component name verbatim.
    vi.mocked(fetchStories).mockResolvedValue({
      stories: [UNSAFE_NAME_STORY],
      headers: new Headers({ Total: "1", "Per-Page": "100" }),
    });
    vi.mocked(fetchStory).mockResolvedValue(UNSAFE_NAME_STORY);
    this.canUpdateStory();
    vol.fromJSON({
      [`./.storyblok/migrations/12345/${UNSAFE_COMPONENT_NAME}.js`]: "only the filename matters!",
    });
    vi.spyOn(filesystem, "importModule").mockImplementation(() =>
      Promise.resolve({ default: (block: any) => ({ ...block, migrated: true }) }),
    );
  },
  failsToFetchOneStory() {
    vi.mocked(fetchStories).mockResolvedValue({
      stories: [unfetchableStory, mockStory],
      headers: new Headers({ Total: "2", "Per-Page": "100" }),
    });
    vi.mocked(fetchStory).mockImplementation(async (_spaceId, storyId) => {
      if (storyId === unfetchableStory.id.toString()) {
        throw new APIError(
          "server_error",
          "pull_story",
          new FetchError("Internal Server Error", {
            status: 500,
            statusText: "Internal Server Error",
            data: { error: "Story could not be loaded" },
          }),
        );
      }
      return mockStory;
    });
    this.canUpdateStory();
    this.canLoadMigrationFunction();
  },
  failsToApplyMigrationToStory() {
    this.canFetchStories();
    this.canFetchStory();
    this.canUpdateStory();
    this.canLoadMigrationFunction(() => {
      throw new Error("Cannot read properties of undefined (reading 'title')");
    });
  },
  failsToUpdateEveryStory() {
    this.canFetchStories();
    this.canFetchStory();
    this.canLoadMigrationFunction();
    vi.mocked(updateStory).mockRejectedValue(
      new APIError(
        "unprocessable_entity",
        "update_story",
        new FetchError("Unprocessable Entity", {
          status: 422,
          statusText: "Unprocessable Entity",
          data: { error: WORKFLOW_STAGE_ERROR },
        }),
      ),
    );
  },
  isNotAuthorizedToFetchStory() {
    this.canFetchStories();
    this.canUpdateStory();
    this.canLoadMigrationFunction();
    vi.mocked(fetchStory).mockRejectedValue(
      new APIError(
        "unauthorized",
        "pull_story",
        new FetchError("Unauthorized", { status: 401, statusText: "Unauthorized" }),
      ),
    );
  },
  isNotAuthorizedToUpdateStory() {
    this.canFetchStories();
    this.canFetchStory();
    this.canLoadMigrationFunction();
    vi.mocked(updateStory).mockRejectedValue(
      new APIError(
        "unauthorized",
        "update_story",
        new FetchError("Unauthorized", { status: 401, statusText: "Unauthorized" }),
      ),
    );
  },
  failsToUpdateOneStory() {
    vi.mocked(fetchStories).mockResolvedValue({
      stories: [unpublishableStory, mockStory],
      headers: new Headers({ Total: "2", "Per-Page": "100" }),
    });
    vi.mocked(fetchStory).mockImplementation(async (_spaceId, storyId) =>
      storyId === unpublishableStory.id.toString() ? unpublishableStory : mockStory,
    );
    vi.mocked(updateStory).mockImplementation(async (_spaceId, storyId) => {
      if (storyId === unpublishableStory.id) {
        throw new APIError(
          "unprocessable_entity",
          "update_story",
          new FetchError("Unprocessable Entity", {
            status: 422,
            statusText: "Unprocessable Entity",
            data: { error: WORKFLOW_STAGE_ERROR },
          }),
        );
      }
      return mockStory;
    });
    this.canLoadMigrationFunction();
  },
  canMigrateFromSpace() {
    this.canFetchStories();
    this.canFetchStory();
    this.canUpdateStory();
    vol.fromJSON({
      [FROM_SPACE_MIGRATION_FILE_PATH]: "only the filename matters!",
    });
    const importModuleSpy = vi.spyOn(filesystem, "importModule");
    importModuleSpy.mockImplementation(() =>
      Promise.resolve({ default: (block: any) => ({ ...block, migrated: true }) }),
    );
  },
};

describe("migrations run command", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    vol.reset();
    resetReporter();
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.exitCode = undefined;
  });

  it("should apply a migration for a component whose name is not filename-safe", async () => {
    preconditions.canMigrateComponentWithUnsafeName();
    resetLogger();

    await migrationsCommand.parseAsync([
      "node",
      "test",
      "run",
      UNSAFE_COMPONENT_NAME,
      "--space",
      "12345",
    ]);

    expect(updateStory).toHaveBeenCalledWith(
      "12345",
      517473243,
      expect.objectContaining({
        story: expect.objectContaining({
          content: expect.objectContaining({
            body: [
              expect.objectContaining({ component: UNSAFE_COMPONENT_NAME, migrated: true }),
              COLLIDING_NAME_BLOCK,
            ],
          }),
        }),
      }),
    );
  });

  it("should apply a migration file an older version generated under the raw name", async () => {
    preconditions.canMigrateComponentWithLegacyFilename();
    resetLogger();

    await migrationsCommand.parseAsync([
      "node",
      "test",
      "run",
      UNSAFE_COMPONENT_NAME,
      "--space",
      "12345",
    ]);

    expect(updateStory).toHaveBeenCalledWith(
      "12345",
      517473243,
      expect.objectContaining({
        story: expect.objectContaining({
          content: expect.objectContaining({
            body: [
              expect.objectContaining({ component: UNSAFE_COMPONENT_NAME, migrated: true }),
              COLLIDING_NAME_BLOCK,
            ],
          }),
        }),
      }),
    );
  });

  it("should warn that a migration file generated under a raw name needs regenerating", async () => {
    preconditions.canMigrateComponentWithLegacyFilename();
    resetLogger();

    await migrationsCommand.parseAsync(["node", "test", "run", "--space", "12345"]);

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(`${UNSAFE_COMPONENT_NAME}.js`),
    );
  });

  it("should apply every migration when no component name narrows the run", async () => {
    preconditions.canMigrateComponentWithUnsafeName();
    resetLogger();

    await migrationsCommand.parseAsync(["node", "test", "run", "--space", "12345"]);

    expect(updateStory).toHaveBeenCalledWith(
      "12345",
      517473243,
      expect.objectContaining({
        story: expect.objectContaining({
          content: expect.objectContaining({
            body: [
              expect.objectContaining({ component: UNSAFE_COMPONENT_NAME, migrated: true }),
              COLLIDING_NAME_BLOCK,
            ],
          }),
        }),
      }),
    );
  });

  it("should run migrations successfully", async () => {
    preconditions.canMigrate();

    // Reset logger right before parseAsync to ensure preAction creates it with proper transports
    resetLogger();

    await migrationsCommand.parseAsync(["node", "test", "run", "--space", "12345"]);

    expect(fetchStories).toHaveBeenCalledWith(
      "12345",
      expect.objectContaining({
        per_page: 500,
        page: 1,
        story_only: true,
      }),
    );
    expect(fetchStory).toHaveBeenCalledWith("12345", "517473243");
    // Report
    const reportFile = Object.entries(vol.toJSON()).find(([filename]) =>
      filename.includes("reports/12345/storyblok-migrations-run-"),
    )?.[1];
    const parsedReport = JSON.parse(reportFile || "{}");
    expect(parsedReport).toEqual({
      status: "SUCCESS",
      meta: {
        runId: expect.any(String),
        command: "storyblok migrations run",
        cliVersion: expect.any(String),
        startedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        endedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        durationMs: expect.any(Number),
        logPath: expect.any(String),
        config: expect.objectContaining({
          space: "12345",
        }),
      },
      summary: {
        migrationResults: {
          failed: 0,
          skipped: 0,
          succeeded: 1,
          total: 1,
        },
        updateResults: {
          failed: 0,
          succeeded: 1,
          total: 1,
        },
      },
    });
    // Logging
    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain("Migration finished");
    expect(logFile).toContain('{"total":1,"succeeded":1,"skipped":0,"failed":0}');
    expect(logFile).toContain('{"total":1,"succeeded":1,"failed":0}');
    // UI
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Migration Results:"));
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Update Results: 1 stories updated."),
    );
    expect(process.exitCode).toBe(0);
  });

  it("should report a run with only skipped migrations as success", async () => {
    preconditions.canMigrateNoChange();

    resetLogger();

    await migrationsCommand.parseAsync(["node", "test", "run", "--space", "12345"]);

    const reportFile = Object.entries(vol.toJSON()).find(([filename]) =>
      filename.includes("reports/12345/storyblok-migrations-run-"),
    )?.[1];
    expect(JSON.parse(reportFile || "{}")).toMatchObject({
      status: "SUCCESS",
      meta: expect.any(Object),
      summary: {
        migrationResults: {
          failed: 0,
          skipped: 1,
          succeeded: 0,
          total: 1,
        },
        updateResults: {
          failed: 0,
          succeeded: 0,
          total: 0,
        },
      },
    });
  });

  it("should gracefully handle error while loading migration", async () => {
    preconditions.canNotLoadMigrationFunction();

    resetLogger();

    await migrationsCommand.parseAsync(["node", "test", "run", "--space", "12345"]);

    expect(updateStory).not.toHaveBeenCalled();
    // Report
    const reportFile = Object.entries(vol.toJSON()).find(([filename]) =>
      filename.includes("reports/12345/storyblok-migrations-run-"),
    )?.[1];
    expect(JSON.parse(reportFile || "{}")).toEqual({
      status: "FAILURE",
      meta: expect.any(Object),
      summary: {
        migrationResults: {
          failed: 1,
          skipped: 0,
          succeeded: 0,
          total: 1,
        },
        updateResults: {
          failed: 0,
          succeeded: 0,
          total: 0,
        },
      },
    });
    // Logging
    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain("Couldn't load migration function");
    expect(logFile).toContain("MIGRATION_LOAD_ERROR");
    // UI
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Migration Results:"));
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("No stories required updates"),
    );
  });

  it("should gracefully handle non-existing migrations directory", async () => {
    preconditions.migrationDirectoryDoesNotExist();

    resetLogger();

    await migrationsCommand.parseAsync(["node", "test", "run", "--space", "12345"]);

    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain('No directory found for space \\"12345\\".');
  });

  it("should handle dry run mode correctly", async () => {
    preconditions.canMigrate();

    resetLogger();

    await migrationsCommand.parseAsync(["node", "test", "run", "--space", "12345", "--dry-run"]);

    expect(fetchStories).toHaveBeenCalledWith(
      "12345",
      expect.objectContaining({
        per_page: 500,
        page: 1,
        story_only: true,
      }),
    );
    expect(fetchStory).toHaveBeenCalledWith("12345", "517473243");
    // Verify that updateStory was NOT called (since it's a dry run)
    expect(updateStory).not.toHaveBeenCalled();
    // Logging
    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain("Dry run mode enabled");
    expect(logFile).toContain("Migration finished");
    // UI
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("DRY RUN MODE ENABLED: No changes will be made."),
    );
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Migration Results:"));
  });

  it("should handle component filtering correctly", async () => {
    preconditions.canMigrate();

    // Run the command with component filter
    await migrationsCommand.parseAsync([
      "node",
      "test",
      "run",
      "migration-component",
      "--space",
      "12345",
    ]);

    expect(fetchStories).toHaveBeenCalledWith(
      "12345",
      expect.objectContaining({
        per_page: 500,
        page: 1,
        contain_component: "migration-component",
        story_only: true,
      }),
    );
    expect(fetchStory).toHaveBeenCalledWith("12345", "517473243");
  });

  it("should strip a leading slash from --starts-with so the prefix still matches", async () => {
    preconditions.canMigrate();

    await migrationsCommand.parseAsync([
      "node",
      "test",
      "run",
      "--space",
      "12345",
      "--starts-with",
      "/en/blog/",
    ]);

    // MAPI matches `starts_with` literally and a `full_slug` never starts with a
    // slash, so a leading slash would match nothing.
    expect(fetchStories).toHaveBeenCalledWith(
      "12345",
      expect.objectContaining({ starts_with: "en/blog/" }),
    );
  });

  it("should parse --query into the structured filter_query MAPI requires", async () => {
    preconditions.canMigrate();

    await migrationsCommand.parseAsync([
      "node",
      "test",
      "run",
      "--space",
      "12345",
      "--query",
      "[highlighted][in]=true",
    ]);

    expect(fetchStories).toHaveBeenCalledWith(
      "12345",
      expect.objectContaining({ filter_query: { highlighted: { in: "true" } } }),
    );
  });

  it("should read migration files from --from space and apply to --space", async () => {
    preconditions.canMigrateFromSpace();

    resetLogger();

    await migrationsCommand.parseAsync([
      "node",
      "test",
      "run",
      "--space",
      "12345",
      "--from",
      "67890",
    ]);

    // Stories should be fetched from the target space (--space)
    expect(fetchStories).toHaveBeenCalledWith(
      "12345",
      expect.objectContaining({
        per_page: 500,
        page: 1,
        story_only: true,
      }),
    );
    expect(fetchStory).toHaveBeenCalledWith("12345", "517473243");

    // Migration module should be loaded from the --from space directory, not --space
    expect(filesystem.importModule).toHaveBeenCalledWith(
      expect.stringContaining("/migrations/67890/"),
    );
    expect(filesystem.importModule).not.toHaveBeenCalledWith(
      expect.stringContaining("/migrations/12345/"),
    );

    // Migration should be applied successfully
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Migration Results:"));
  });

  it("should show info message when --from is provided", async () => {
    preconditions.canMigrateFromSpace();

    resetLogger();

    await migrationsCommand.parseAsync([
      "node",
      "test",
      "run",
      "--space",
      "12345",
      "--from",
      "67890",
    ]);

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("from"));
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("67890"));
  });

  it("should reference --from space in error when migration directory does not exist", async () => {
    preconditions.migrationDirectoryDoesNotExist();

    resetLogger();

    await migrationsCommand.parseAsync([
      "node",
      "test",
      "run",
      "--space",
      "12345",
      "--from",
      "67890",
    ]);

    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain('No directory found for space \\"67890\\".');
  });

  it("should keep migrating the other stories when one story can't be fetched", async () => {
    preconditions.failsToFetchOneStory();
    resetLogger();

    await migrationsCommand.parseAsync(["node", "test", "run", "--space", "12345"]);

    expect(updateStory).toHaveBeenCalledTimes(1);
    expect(updateStory).toHaveBeenCalledWith("12345", mockStory.id, expect.any(Object));
    // UI
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(
        `Unfetchable Story (id ${unfetchableStory.id}): Failed to fetch story: Story could not be loaded`,
      ),
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "Migration Results: 1 stories updated, 0 stories skipped, 1 stories failed.",
      ),
    );
    expect(process.exitCode).toBe(1);
    // Report
    const reportFile = Object.entries(vol.toJSON()).find(([filename]) =>
      filename.includes("reports/12345/storyblok-migrations-run-"),
    )?.[1];
    expect(JSON.parse(reportFile || "{}")).toMatchObject({
      status: "PARTIAL_SUCCESS",
      summary: {
        migrationResults: { total: 2, succeeded: 1, failed: 1 },
        updateResults: { total: 1, succeeded: 1, failed: 0 },
      },
    });
    // Logging
    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain("MIGRATION_STORY_FETCH_ERROR");
    expect(logFile).toContain("Unfetchable Story");
    expect(logFile).toContain("Migration finished");
  });

  it("should list a story that failed to update with the reason the API gave", async () => {
    preconditions.failsToUpdateOneStory();
    resetLogger();

    await migrationsCommand.parseAsync(["node", "test", "run", "--space", "12345"]);

    expect(updateStory).toHaveBeenCalledTimes(2);
    // UI
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(
        `Unpublishable Story (id ${unpublishableStory.id}): ${WORKFLOW_STAGE_ERROR}`,
      ),
    );
    expect(process.exitCode).toBe(1);
    // Report
    const reportFile = Object.entries(vol.toJSON()).find(([filename]) =>
      filename.includes("reports/12345/storyblok-migrations-run-"),
    )?.[1];
    expect(JSON.parse(reportFile || "{}")).toMatchObject({
      status: "PARTIAL_SUCCESS",
      summary: {
        updateResults: { total: 2, succeeded: 1, failed: 1 },
      },
    });
    // Logging
    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain(WORKFLOW_STAGE_ERROR);
    expect(logFile).toContain("Unpublishable Story");
  });

  it("should report a run where every story update failed as a failure", async () => {
    preconditions.failsToUpdateEveryStory();
    resetLogger();

    await migrationsCommand.parseAsync(["node", "test", "run", "--space", "12345"]);

    const reportFile = Object.entries(vol.toJSON()).find(([filename]) =>
      filename.includes("reports/12345/storyblok-migrations-run-"),
    )?.[1];
    expect(JSON.parse(reportFile || "{}")).toMatchObject({
      status: "FAILURE",
      summary: {
        migrationResults: { total: 1, succeeded: 1, failed: 0 },
        updateResults: { total: 1, succeeded: 0, failed: 1 },
      },
    });
    expect(process.exitCode).toBe(1);
  });

  it("should list a story the migration function failed on with the reason", async () => {
    preconditions.failsToApplyMigrationToStory();
    resetLogger();

    await migrationsCommand.parseAsync(["node", "test", "run", "--space", "12345"]);

    expect(updateStory).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(
        `Test Story (id ${mockStory.id}): Cannot read properties of undefined (reading 'title')`,
      ),
    );
    expect(process.exitCode).toBe(1);
  });

  it("should stop the run and still print the summary when fetching stories is not authorized", async () => {
    preconditions.isNotAuthorizedToFetchStory();
    resetLogger();

    await migrationsCommand.parseAsync(["node", "test", "run", "--space", "12345"]);

    expect(updateStory).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "Migration Results: 0 stories updated, 0 stories skipped, 1 stories failed.",
      ),
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("The user is not authorized to access the API"),
    );
    const reportFile = Object.entries(vol.toJSON()).find(([filename]) =>
      filename.includes("reports/12345/storyblok-migrations-run-"),
    )?.[1];
    expect(JSON.parse(reportFile || "{}")).toMatchObject({ status: "FAILURE" });
    expect(process.exitCode).toBe(1);
  });

  it("should stop the run and still print the summary when updating stories is not authorized", async () => {
    preconditions.isNotAuthorizedToUpdateStory();
    resetLogger();

    await migrationsCommand.parseAsync(["node", "test", "run", "--space", "12345"]);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Update Results: 0 stories updated, 1 stories failed."),
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("The user is not authorized to access the API"),
    );
    const reportFile = Object.entries(vol.toJSON()).find(([filename]) =>
      filename.includes("reports/12345/storyblok-migrations-run-"),
    )?.[1];
    expect(JSON.parse(reportFile || "{}")).toMatchObject({ status: "FAILURE" });
    expect(process.exitCode).toBe(1);
  });
});
