import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { session } from "../../../session";
import { CommandError, konsola } from "../../../utils";
import { vol } from "memfs";
import type { Component } from "../constants";
// Import the main module first to ensure proper initialization
import "../index";
import { componentsCommand } from "../command";
import { loggedOutSessionState } from "../../../../test/setup";
import {
  fetchComponentGroups,
  fetchComponentInternalTags,
  fetchComponentPresets,
  fetchComponents,
} from "../actions";
import { deleteComponentPreset, upsertComponent } from "./actions";
import { getUI } from "../../../utils/ui";

vi.mock("./actions", async () => {
  const actual = await vi.importActual("./actions");
  return {
    ...actual,
    pushComponent: vi.fn(),
    updateComponent: vi.fn(),
    upsertComponent: vi.fn(),
    pushComponentGroup: vi.fn(),
    updateComponentGroup: vi.fn(),
    upsertComponentGroup: vi.fn(),
    pushComponentPreset: vi.fn(),
    updateComponentPreset: vi.fn(),
    upsertComponentPreset: vi.fn(),
    deleteComponentPreset: vi.fn(),
    pushComponentInternalTag: vi.fn(),
    updateComponentInternalTag: vi.fn(),
    upsertComponentInternalTag: vi.fn(),
  };
});

vi.mock("../actions", () => ({
  fetchComponents: vi.fn().mockResolvedValue([]),
  fetchComponentGroups: vi.fn().mockResolvedValue([]),
  fetchComponentPresets: vi.fn().mockResolvedValue([]),
  fetchComponentInternalTags: vi.fn().mockResolvedValue([]),
}));

// konsola mock still needed: handleError (shared utility) uses konsola internally
vi.mock("../../../utils/konsola");

const mockComponent: Component = {
  name: "test-component",
  display_name: "Test Component",
  created_at: "2021-08-09T12:00:00Z",
  updated_at: "2021-08-09T12:00:00Z",
  id: 1,
  schema: { type: "object" },
  is_root: false,
  is_nestable: true,
  all_presets: [],
  real_name: "test-component",
  internal_tags_list: [],
  internal_tag_ids: [],
};

const preconditions = {
  loggedOut() {
    vi.mocked(session().initializeSession).mockImplementation(async () => {
      session().state = loggedOutSessionState();
    });
  },
};

describe("push", () => {
  let ui: ReturnType<typeof getUI>;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    vol.reset();
    ui = getUI();
    vi.spyOn(ui, "info");
    vi.spyOn(ui, "warn");
    vi.spyOn(ui, "br");
    vi.spyOn(ui, "title");
    // Reset the option values
    (componentsCommand as any)._optionValues = {};
    (componentsCommand as any)._optionValueSources = {};
    for (const command of componentsCommand.commands) {
      (command as any)._optionValueSources = {};
      (command as any)._optionValues = {};
    }
  });

  afterEach(() => {
    vol.reset();
  });

  describe("default mode", () => {
    it("should use target space as from space when --from option is not provided", async () => {
      // Create mock filesystem with components for the target space
      vol.fromJSON({
        ".storyblok/components/12345/components.json": JSON.stringify([mockComponent]),
      });

      await componentsCommand.parseAsync(["node", "test", "push", "--space", "12345"]);

      // The readComponentsFiles should have been called and should read from space 12345
      // Since we're reading from the same space as we're pushing to
      expect(ui.info).toHaveBeenCalledWith(
        expect.stringContaining("from") && expect.stringContaining("12345"),
      );
    });

    it("should use the --from option when provided", async () => {
      // Create mock filesystem with components for the source space
      vol.fromJSON({
        ".storyblok/components/source-space/components.json": JSON.stringify([mockComponent]),
      });

      await componentsCommand.parseAsync([
        "node",
        "test",
        "push",
        "--space",
        "target-space",
        "--from",
        "source-space",
      ]);

      // The command should indicate pushing from source-space to target-space
      expect(ui.info).toHaveBeenCalledWith(expect.stringContaining("source-space"));
      expect(ui.info).toHaveBeenCalledWith(expect.stringContaining("target-space"));
    });

    // handleError uses konsola internally (not yet migrated to UI), so these assert against konsola
    it("should throw an error if the user is not logged in", async () => {
      preconditions.loggedOut();

      await componentsCommand.parseAsync(["node", "test", "push", "--space", "12345"]);

      expect(konsola.error).toHaveBeenCalledWith(
        "You are currently not logged in. Please run storyblok login to authenticate, or storyblok signup to sign up.",
        null,
        {
          header: true,
        },
      );
    });

    it("should throw an error if the space is not provided", async () => {
      const mockError = new CommandError(
        `Please provide the target space as argument --space TARGET_SPACE_ID.`,
      );

      await componentsCommand.parseAsync(["node", "test", "push"]);

      expect(konsola.error).toHaveBeenCalledWith(mockError.message, null, {
        header: true,
      });
    });
  });

  describe("--separate-files option", () => {
    it("should read from separate files when specified", async () => {
      // Create mock filesystem with separate files
      vol.fromJSON({
        ".storyblok/components/12345/test-component.json": JSON.stringify([mockComponent]),
      });

      await componentsCommand.parseAsync([
        "node",
        "test",
        "push",
        "--space",
        "12345",
        "--separate-files",
      ]);

      // Should proceed without errors if files are found
      expect(ui.info).toHaveBeenCalled();
    });
  });

  describe("preset reconciliation", () => {
    it("should delete stale presets from target when local component has no presets", async () => {
      // Local: component with no presets
      vol.fromJSON({
        ".storyblok/components/source-space/components.json": JSON.stringify([mockComponent]),
      });

      // Target: component exists with a preset that should be deleted
      const targetComponent = { ...mockComponent, id: 100 };
      vi.mocked(fetchComponents).mockResolvedValue([targetComponent]);
      vi.mocked(fetchComponentGroups).mockResolvedValue([]);
      vi.mocked(fetchComponentPresets).mockResolvedValue([
        {
          id: 500,
          name: "stale-preset",
          component_id: 100,
          preset: {},
          created_at: "2021-08-09T12:00:00Z",
          updated_at: "2021-08-09T12:00:00Z",
          space_id: 12345,
        },
      ]);
      vi.mocked(fetchComponentInternalTags).mockResolvedValue([]);
      vi.mocked(upsertComponent).mockResolvedValue(targetComponent);

      await componentsCommand.parseAsync([
        "node",
        "test",
        "push",
        "--space",
        "target-space",
        "--from",
        "source-space",
      ]);

      expect(vi.mocked(deleteComponentPreset)).toHaveBeenCalledWith("target-space", 500);
    });

    it("should not delete presets that exist in both local and target", async () => {
      // Local: component with a preset
      const localPreset = {
        id: 10,
        name: "kept-preset",
        component_id: 1,
        preset: {},
        created_at: "2021-08-09T12:00:00Z",
        updated_at: "2021-08-09T12:00:00Z",
        space_id: 12345,
      };
      vol.fromJSON({
        ".storyblok/components/source-space/components.json": JSON.stringify([mockComponent]),
        ".storyblok/components/source-space/presets.json": JSON.stringify([localPreset]),
      });

      // Target: same preset exists
      const targetComponent = { ...mockComponent, id: 100 };
      vi.mocked(fetchComponents).mockResolvedValue([targetComponent]);
      vi.mocked(fetchComponentGroups).mockResolvedValue([]);
      vi.mocked(fetchComponentPresets).mockResolvedValue([
        {
          id: 500,
          name: "kept-preset",
          component_id: 100,
          preset: {},
          created_at: "2021-08-09T12:00:00Z",
          updated_at: "2021-08-09T12:00:00Z",
          space_id: 12345,
        },
      ]);
      vi.mocked(fetchComponentInternalTags).mockResolvedValue([]);
      vi.mocked(upsertComponent).mockResolvedValue(targetComponent);

      await componentsCommand.parseAsync([
        "node",
        "test",
        "push",
        "--space",
        "target-space",
        "--from",
        "source-space",
      ]);

      expect(vi.mocked(deleteComponentPreset)).not.toHaveBeenCalled();
    });

    it("should only delete presets for components being pushed", async () => {
      // Local: only pushing mockComponent (id: 1), not "other-component"
      vol.fromJSON({
        ".storyblok/components/source-space/components.json": JSON.stringify([mockComponent]),
      });

      const targetComponent = { ...mockComponent, id: 100 };
      const otherComponent: SpaceComponent = {
        ...mockComponent,
        id: 200,
        name: "other-component",
        display_name: "Other Component",
      };
      vi.mocked(fetchComponents).mockResolvedValue([targetComponent, otherComponent]);
      vi.mocked(fetchComponentGroups).mockResolvedValue([]);
      vi.mocked(fetchComponentPresets).mockResolvedValue([
        // Preset for other-component - should NOT be deleted
        {
          id: 600,
          name: "other-preset",
          component_id: 200,
          preset: {},
          created_at: "2021-08-09T12:00:00Z",
          updated_at: "2021-08-09T12:00:00Z",
          space_id: 12345,
        },
      ]);
      vi.mocked(fetchComponentInternalTags).mockResolvedValue([]);
      vi.mocked(upsertComponent).mockResolvedValue(targetComponent);

      await componentsCommand.parseAsync([
        "node",
        "test",
        "push",
        "--space",
        "target-space",
        "--from",
        "source-space",
      ]);

      // Should not delete presets for components not being pushed
      expect(vi.mocked(deleteComponentPreset)).not.toHaveBeenCalled();
    });
  });
});
