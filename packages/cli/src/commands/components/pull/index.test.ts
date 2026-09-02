import { beforeEach, describe, expect, it, vi } from "vitest";
import { session } from "../../../session";
import { CommandError } from "../../../utils";
import {
  fetchComponent,
  fetchComponentGroups,
  fetchComponentInternalTags,
  fetchComponents,
  saveComponentsToFiles,
} from "./actions";
import chalk from "chalk";
import { colorPalette } from "../../../constants";
// Import the main module first to ensure proper initialization
import "../index";
import { componentsCommand } from "../command";
import { loggedOutSessionState } from "../../../../test/setup";
import { getUI } from "../../../lib/ui";
import { getProgram } from "../../../program";
import type { Component } from "../constants";

function component(overrides: Partial<Component> & { id: number; name: string }): Component {
  return {
    ...overrides,
    display_name: overrides.display_name ?? null,
    created_at: overrides.created_at ?? "",
    updated_at: overrides.updated_at ?? "",
    schema: overrides.schema ?? {},
    is_root: overrides.is_root ?? false,
    is_nestable: overrides.is_nestable ?? false,
    internal_tags_list: overrides.internal_tags_list ?? [],
    internal_tag_ids: overrides.internal_tag_ids ?? [],
  };
}

vi.mock("./actions", () => ({
  fetchComponents: vi.fn(),
  fetchComponent: vi.fn(),
  fetchComponentGroups: vi.fn(),
  fetchComponentPresets: vi.fn(),
  fetchComponentInternalTags: vi.fn(),
  saveComponentsToFiles: vi.fn(),
}));

const preconditions = {
  loggedOut() {
    vi.mocked(session().initializeSession).mockImplementation(async () => {
      session().state = loggedOutSessionState();
    });
  },
};

describe("pull", () => {
  let ui: ReturnType<typeof getUI>;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    ui = getUI();
    vi.spyOn(ui, "ok");
    vi.spyOn(ui, "warn");
    vi.spyOn(ui, "br");
    vi.spyOn(ui, "title");
    // Reset the option values
    getProgram().setOptionValueWithSource("path", undefined, "default");
    (componentsCommand as any)._optionValues = {};
    (componentsCommand as any)._optionValueSources = {};
    for (const command of componentsCommand.commands) {
      (command as any)._optionValueSources = {};
      (command as any)._optionValues = {};
    }
  });

  describe("default mode", () => {
    it("should prompt the user if the operation was sucessfull", async () => {
      const mockResponse: Component[] = [
        component({
          name: "component-name",
          display_name: "Component Name",
          created_at: "2021-08-09T12:00:00Z",
          updated_at: "2021-08-09T12:00:00Z",
          id: 12345,
          schema: {},
          color: undefined,
        }),
        component({
          name: "component-name-2",
          display_name: "Component Name 2",
          created_at: "2021-08-09T12:00:00Z",
          updated_at: "2021-08-09T12:00:00Z",
          id: 12346,
          schema: {},
          color: undefined,
        }),
      ];

      vi.mocked(fetchComponents).mockResolvedValue(mockResponse);

      await componentsCommand.parseAsync(["node", "test", "pull", "--space", "12345"]);

      expect(fetchComponents).toHaveBeenCalledWith("12345");
      expect(saveComponentsToFiles).toHaveBeenCalledWith(
        "12345",
        {
          components: mockResponse,
          groups: [],
          presets: [],
          internalTags: [],
          datasources: [],
        },
        expect.objectContaining({
          separateFiles: false,
        }),
      );
      expect(ui.ok).toHaveBeenCalledWith(
        `Components downloaded successfully to ${chalk.hex(colorPalette.PRIMARY)(`.storyblok/components/12345/components.json`)}`,
      );
    });

    it("should fetch a component by name", async () => {
      const mockResponse: Component = component({
        name: "component-name",
        display_name: "Component Name",
        created_at: "2021-08-09T12:00:00Z",
        updated_at: "2021-08-09T12:00:00Z",
        id: 12345,
        schema: {},
        color: undefined,
        internal_tags_list: [{ id: 1, name: "tag" }],
        internal_tag_ids: ["1"],
      });
      vi.mocked(fetchComponent).mockResolvedValue(mockResponse);
      await componentsCommand.parseAsync([
        "node",
        "test",
        "pull",
        "component-name",
        "--space",
        "12345",
      ]);
      expect(fetchComponent).toHaveBeenCalledWith("12345", "component-name");
      expect(saveComponentsToFiles).toHaveBeenCalledWith(
        "12345",
        {
          components: [mockResponse],
          groups: [],
          presets: [],
          internalTags: [],
          datasources: [],
        },
        expect.objectContaining({ separateFiles: true }),
      );
    });

    it("should return early without saving if the component is not found", async () => {
      vi.mocked(fetchComponent).mockResolvedValue(undefined);
      await componentsCommand.parseAsync([
        "node",
        "test",
        "pull",
        "component-name",
        "--space",
        "12345",
      ]);
      expect(saveComponentsToFiles).not.toHaveBeenCalled();
    });

    it("should return early without saving if no components exist in the space", async () => {
      vi.mocked(fetchComponents).mockResolvedValue([]);
      await componentsCommand.parseAsync(["node", "test", "pull", "--space", "12345"]);
      expect(saveComponentsToFiles).not.toHaveBeenCalled();
    });

    it("should throw an error if the user is not logged in", async () => {
      preconditions.loggedOut();
      await componentsCommand.parseAsync(["node", "test", "pull", "--space", "12345"]);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("You are currently not logged in"),
      );
    });

    it("should throw an error if the space is not provided", async () => {
      const mockError = new CommandError(
        `Please provide the space as argument --space YOUR_SPACE_ID.`,
      );

      await componentsCommand.parseAsync(["node", "test", "pull"]);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining(mockError.message));
    });
  });

  describe("--path option", () => {
    it("should save the file at the provided path", async () => {
      const mockResponse: Component[] = [
        component({
          name: "component-name",
          display_name: "Component Name",
          created_at: "2021-08-09T12:00:00Z",
          updated_at: "2021-08-09T12:00:00Z",
          id: 12345,
          schema: {},
          color: undefined,
        }),
      ];

      vi.mocked(fetchComponents).mockResolvedValue(mockResponse);

      const program = getProgram();
      program.setOptionValueWithSource("path", "/path/to/components", "cli");
      await componentsCommand.parseAsync(["node", "test", "pull", "--space", "12345"]);
      expect(fetchComponents).toHaveBeenCalledWith("12345");
      expect(saveComponentsToFiles).toHaveBeenCalledWith(
        "12345",
        {
          components: mockResponse,
          groups: [],
          presets: [],
          internalTags: [],
          datasources: [],
        },
        expect.objectContaining({ path: "/path/to/components", separateFiles: false }),
      );
      expect(ui.ok).toHaveBeenCalledWith(
        `Components downloaded successfully to ${chalk.hex(colorPalette.PRIMARY)(`/path/to/components/components/12345/components.json`)}`,
      );
    });
  });

  describe("--filename option", () => {
    it("should save the file with the custom filename", async () => {
      const mockResponse: Component[] = [
        component({
          name: "component-name",
          display_name: "Component Name",
          created_at: "2021-08-09T12:00:00Z",
          updated_at: "2021-08-09T12:00:00Z",
          id: 12345,
          schema: {},
          color: undefined,
        }),
      ];

      vi.mocked(fetchComponents).mockResolvedValue(mockResponse);

      await componentsCommand.parseAsync([
        "node",
        "test",
        "pull",
        "--space",
        "12345",
        "--filename",
        "custom",
      ]);
      expect(fetchComponents).toHaveBeenCalledWith("12345");
      expect(saveComponentsToFiles).toHaveBeenCalledWith(
        "12345",
        {
          components: mockResponse,
          groups: [],
          presets: [],
          internalTags: [],
          datasources: [],
        },
        expect.objectContaining({ filename: "custom", separateFiles: false }),
      );
      expect(ui.ok).toHaveBeenCalledWith(
        `Components downloaded successfully to ${chalk.hex(colorPalette.PRIMARY)(`.storyblok/components/12345/custom.json`)}`,
      );
    });
  });

  describe("--separate-files option", () => {
    it("should save each component in a separate file", async () => {
      const mockResponse: Component[] = [
        component({
          name: "component-name",
          display_name: "Component Name",
          created_at: "2021-08-09T12:00:00Z",
          updated_at: "2021-08-09T12:00:00Z",
          id: 12345,
          schema: {},
          color: undefined,
          internal_tags_list: [{ id: 1, name: "tag" }],
          internal_tag_ids: ["1"],
        }),
        component({
          name: "component-name-2",
          display_name: "Component Name 2",
          created_at: "2021-08-09T12:00:00Z",
          updated_at: "2021-08-09T12:00:00Z",
          id: 12346,
          schema: {},
          color: undefined,
          internal_tags_list: [{ id: 1, name: "tag" }],
          internal_tag_ids: ["1"],
        }),
      ];

      vi.mocked(fetchComponents).mockResolvedValue(mockResponse);

      await componentsCommand.parseAsync([
        "node",
        "test",
        "pull",
        "--space",
        "12345",
        "--separate-files",
      ]);
      expect(fetchComponents).toHaveBeenCalledWith("12345");
      expect(saveComponentsToFiles).toHaveBeenCalledWith(
        "12345",
        {
          components: mockResponse,
          groups: [],
          presets: [],
          internalTags: [],
          datasources: [],
        },
        expect.objectContaining({ separateFiles: true }),
      );
      expect(ui.ok).toHaveBeenCalledWith(
        `Components downloaded successfully to ${chalk.hex(colorPalette.PRIMARY)(`.storyblok/components/12345/`)}`,
      );
    });

    it("should warn the user if the --filename is used along", async () => {
      const mockResponse: Component[] = [
        component({
          name: "component-name",
          display_name: "Component Name",
          created_at: "2021-08-09T12:00:00Z",
          updated_at: "2021-08-09T12:00:00Z",
          id: 12345,
          schema: {},
          color: undefined,
          internal_tags_list: [{ id: 1, name: "tag" }],
          internal_tag_ids: ["1"],
        }),
      ];

      vi.mocked(fetchComponents).mockResolvedValue(mockResponse);

      await componentsCommand.parseAsync([
        "node",
        "test",
        "pull",
        "--space",
        "12345",
        "--separate-files",
        "--filename",
        "custom",
      ]);
      expect(fetchComponents).toHaveBeenCalledWith("12345");
      expect(saveComponentsToFiles).toHaveBeenCalledWith(
        "12345",
        {
          components: mockResponse,
          groups: [],
          presets: [],
          internalTags: [],
          datasources: [],
        },
        expect.objectContaining({ separateFiles: true, filename: "custom" }),
      );
      expect(ui.warn).toHaveBeenCalledWith(
        `The --filename option is ignored when using --separate-files`,
      );
    });
  });

  describe("--filter option", () => {
    it("should save only components matching the glob and their dependencies", async () => {
      const checkout: Component = {
        ...component({ id: 1, name: "checkout-form" }),
        name: "checkout-form",
        display_name: "Checkout Form",
        id: 1,
        created_at: "",
        updated_at: "",
      };
      const hero: Component = {
        ...component({ id: 2, name: "hero" }),
        name: "hero",
        display_name: "Hero",
        id: 2,
        created_at: "",
        updated_at: "",
      };

      vi.mocked(fetchComponents).mockResolvedValue([checkout, hero]);

      await componentsCommand.parseAsync([
        "node",
        "test",
        "pull",
        "--space",
        "12345",
        "--filter",
        "checkout-*",
      ]);

      expect(saveComponentsToFiles).toHaveBeenCalledWith(
        "12345",
        expect.objectContaining({
          components: [checkout],
        }),
        expect.any(Object),
      );
    });

    it("should warn and not save when the glob matches nothing", async () => {
      const hero: Component = {
        ...component({ id: 2, name: "hero" }),
        name: "hero",
        display_name: "Hero",
        id: 2,
        created_at: "",
        updated_at: "",
      };
      vi.mocked(fetchComponents).mockResolvedValue([hero]);

      await componentsCommand.parseAsync([
        "node",
        "test",
        "pull",
        "--space",
        "12345",
        "--filter",
        "checkout-*",
      ]);

      expect(saveComponentsToFiles).not.toHaveBeenCalled();
      expect(ui.warn).toHaveBeenCalledWith("No components found matching the given selectors.");
    });
  });

  describe("--group and --tag options", () => {
    const inCheckout: Component = {
      ...component({ id: 1, name: "checkout-form" }),
      name: "checkout-form",
      display_name: "Checkout Form",
      id: 1,
      created_at: "",
      updated_at: "",
      component_group_uuid: "checkout",
      internal_tag_ids: ["10"],
    };
    const inMarketing: Component = {
      ...component({ id: 2, name: "hero" }),
      name: "hero",
      display_name: "Hero",
      id: 2,
      created_at: "",
      updated_at: "",
      component_group_uuid: "marketing",
    };
    const checkoutGroup = {
      id: 1,
      uuid: "checkout",
      name: "Checkout",
      parent_id: null,
      parent_uuid: null,
    };
    const marketingGroup = {
      id: 2,
      uuid: "marketing",
      name: "Marketing",
      parent_id: null,
      parent_uuid: null,
    };
    const betaTag = { id: 10, name: "beta", object_type: "component" as const };

    beforeEach(() => {
      vi.mocked(fetchComponents).mockResolvedValue([inCheckout, inMarketing]);
      vi.mocked(fetchComponentGroups).mockResolvedValue([checkoutGroup, marketingGroup]);
      vi.mocked(fetchComponentInternalTags).mockResolvedValue([betaTag]);
    });

    it("pulls only components in the named group and its dependencies", async () => {
      await componentsCommand.parseAsync([
        "node",
        "test",
        "pull",
        "--space",
        "12345",
        "--group",
        "Checkout",
      ]);
      expect(saveComponentsToFiles).toHaveBeenCalledWith(
        "12345",
        expect.objectContaining({
          components: [inCheckout],
        }),
        expect.any(Object),
      );
    });

    it("pulls only components carrying the named tag", async () => {
      await componentsCommand.parseAsync([
        "node",
        "test",
        "pull",
        "--space",
        "12345",
        "--tag",
        "beta",
      ]);
      expect(saveComponentsToFiles).toHaveBeenCalledWith(
        "12345",
        expect.objectContaining({
          components: [inCheckout],
        }),
        expect.any(Object),
      );
    });

    it("errors on an unknown group name", async () => {
      await componentsCommand.parseAsync([
        "node",
        "test",
        "pull",
        "--space",
        "12345",
        "--group",
        "Ghost",
      ]);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('No component group found named "Ghost"'),
      );
      expect(saveComponentsToFiles).not.toHaveBeenCalled();
    });
  });
});
