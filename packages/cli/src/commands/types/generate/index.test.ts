import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateStoryblokTypes, generateTypes } from "./actions";
// Import the main module first to ensure proper initialization
import "../index";
import { typesCommand } from "../command";
import { readComponentsFiles } from "../../components/push/actions";
import { generateSchemaTypes } from "./schema-types";

const uiTitleMock = vi.hoisted(() => vi.fn());
const uiWarnMock = vi.hoisted(() => vi.fn());
const uiInfoMock = vi.hoisted(() => vi.fn());
const uiOkMock = vi.hoisted(() => vi.fn());
const uiBrMock = vi.hoisted(() => vi.fn());
const uiSpinnerSucceedMock = vi.hoisted(() => vi.fn());
const uiSpinnerFailedMock = vi.hoisted(() => vi.fn());
const uiErrorMock = vi.hoisted(() => vi.fn());

vi.mock("../../../lib/ui", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getUI: () => ({
      title: uiTitleMock,
      warn: uiWarnMock,
      info: uiInfoMock,
      ok: uiOkMock,
      br: uiBrMock,
      error: uiErrorMock,
      createSpinner: () => ({
        start: vi.fn(),
        succeed: uiSpinnerSucceedMock,
        failed: uiSpinnerFailedMock,
      }),
    }),
  };
});

vi.mock("./schema-types", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    generateSchemaTypes: vi.fn(),
  };
});

const mockResponse = [
  {
    name: "component-name",
    display_name: "Component Name",
    created_at: "2021-08-09T12:00:00Z",
    updated_at: "2021-08-09T12:00:00Z",
    id: 12345,
    schema: { type: "object" },
    color: undefined,
    internal_tags_list: [],
    internal_tag_ids: [],
  },
];

const mockSpaceData = {
  components: mockResponse,
  groups: [],
  presets: [],
  internalTags: [],
  datasources: [],
};

vi.mock("./actions", () => ({
  generateStoryblokTypes: vi.fn(),
  generateTypes: vi.fn(),
  saveTypesToComponentsFile: vi.fn(),
  getComponentType: vi.fn(),
}));

vi.mock("../../components/push/actions", () => ({
  readComponentsFiles: vi.fn(),
}));

describe("types generate", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    // Fix the linter errors by using a type assertion
    (typesCommand as any)._optionValues = {};
    (typesCommand as any)._optionValueSources = {};
    for (const command of typesCommand.commands) {
      (command as any)._optionValues = {};
      (command as any)._optionValueSources = {};
    }
  });

  describe("default mode", () => {
    it("should prompt the user if the operation was sucessfull", async () => {
      vi.mocked(readComponentsFiles).mockResolvedValue(mockSpaceData);

      vi.mocked(generateStoryblokTypes).mockResolvedValue(true);
      vi.mocked(generateTypes).mockResolvedValue("// Generated types");

      await typesCommand.parseAsync(["node", "test", "generate", "--space", "12345"]);

      expect(generateStoryblokTypes).toHaveBeenCalledWith({
        path: undefined,
      });

      expect(generateTypes).toHaveBeenCalledWith(mockSpaceData, expect.objectContaining({}));

      expect(uiOkMock).toHaveBeenCalledWith(
        expect.stringContaining("Successfully generated types for space"),
        true,
      );
    });

    it("should pass strict mode option to generateTypes when --strict flag is used", async () => {
      vi.mocked(readComponentsFiles).mockResolvedValue(mockSpaceData);
      vi.mocked(generateStoryblokTypes).mockResolvedValue(true);
      vi.mocked(generateTypes).mockResolvedValue("// Generated types");

      await typesCommand.parseAsync(["node", "test", "generate", "--space", "12345", "--strict"]);

      expect(generateTypes).toHaveBeenCalledWith(
        mockSpaceData,
        expect.objectContaining({
          strict: true,
        }),
      );
    });

    it("should pass typePrefix option to generateTypes when --type-prefix flag is used", async () => {
      vi.mocked(readComponentsFiles).mockResolvedValue(mockSpaceData);
      vi.mocked(generateStoryblokTypes).mockResolvedValue(true);
      vi.mocked(generateTypes).mockResolvedValue("// Generated types");

      await typesCommand.parseAsync([
        "node",
        "test",
        "generate",
        "--space",
        "12345",
        "--type-prefix",
        "Custom",
      ]);

      expect(generateTypes).toHaveBeenCalledWith(
        mockSpaceData,
        expect.objectContaining({
          typePrefix: "Custom",
        }),
      );
    });

    it("should pass typeSuffix option to generateTypes when --type-suffix flag is used", async () => {
      vi.mocked(readComponentsFiles).mockResolvedValue(mockSpaceData);
      vi.mocked(generateStoryblokTypes).mockResolvedValue(true);
      vi.mocked(generateTypes).mockResolvedValue("// Generated types");

      await typesCommand.parseAsync([
        "node",
        "test",
        "generate",
        "--space",
        "12345",
        "--type-suffix",
        "CustomTypeSuffix",
      ]);

      expect(generateTypes).toHaveBeenCalledWith(
        mockSpaceData,
        expect.objectContaining({
          typeSuffix: "CustomTypeSuffix",
        }),
      );
    });

    it("should pass suffix option to generateTypes when --suffix flag is used", async () => {
      vi.mocked(readComponentsFiles).mockResolvedValue(mockSpaceData);
      vi.mocked(generateStoryblokTypes).mockResolvedValue(true);
      vi.mocked(generateTypes).mockResolvedValue("// Generated types");

      await typesCommand.parseAsync([
        "node",
        "test",
        "generate",
        "--space",
        "12345",
        "--suffix",
        "Component",
      ]);

      expect(generateTypes).toHaveBeenCalledWith(
        mockSpaceData,
        expect.objectContaining({
          suffix: "Component",
        }),
      );
    });

    it("should pass separateFiles option to generateTypes when --separate-files flag is used", async () => {
      vi.mocked(readComponentsFiles).mockResolvedValue(mockSpaceData);
      vi.mocked(generateStoryblokTypes).mockResolvedValue(true);
      vi.mocked(generateTypes).mockResolvedValue("// Generated types");

      await typesCommand.parseAsync([
        "node",
        "test",
        "generate",
        "--space",
        "12345",
        "--separate-files",
      ]);

      expect(generateTypes).toHaveBeenCalledWith(
        mockSpaceData,
        expect.objectContaining({
          separateFiles: true,
        }),
      );
    });

    it("should not pass separateFiles to readComponentsFiles even when --separate-files flag is used (auto-detect input)", async () => {
      vi.mocked(readComponentsFiles).mockResolvedValue(mockSpaceData);
      vi.mocked(generateStoryblokTypes).mockResolvedValue(true);
      vi.mocked(generateTypes).mockResolvedValue("// Generated types");

      await typesCommand.parseAsync([
        "node",
        "test",
        "generate",
        "--space",
        "12345",
        "--separate-files",
      ]);

      expect(readComponentsFiles).toHaveBeenCalledWith(
        expect.not.objectContaining({
          separateFiles: true,
        }),
      );
    });

    it("should not pass separateFiles to readComponentsFiles in default mode", async () => {
      vi.mocked(readComponentsFiles).mockResolvedValue(mockSpaceData);
      vi.mocked(generateStoryblokTypes).mockResolvedValue(true);
      vi.mocked(generateTypes).mockResolvedValue("// Generated types");

      await typesCommand.parseAsync(["node", "test", "generate", "--space", "12345"]);

      expect(readComponentsFiles).toHaveBeenCalledWith(
        expect.not.objectContaining({
          separateFiles: expect.anything(),
        }),
      );
    });

    it("should pass suffix to readComponentsFiles when --suffix flag is used", async () => {
      vi.mocked(readComponentsFiles).mockResolvedValue(mockSpaceData);
      vi.mocked(generateStoryblokTypes).mockResolvedValue(true);
      vi.mocked(generateTypes).mockResolvedValue("// Generated types");

      await typesCommand.parseAsync([
        "node",
        "test",
        "generate",
        "--space",
        "12345",
        "--suffix",
        "dev",
      ]);

      expect(readComponentsFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          suffix: "dev",
        }),
      );
    });

    it("should pass customFieldsParser option to generateTypes when --custom-fields-parser flag is used", async () => {
      vi.mocked(readComponentsFiles).mockResolvedValue(mockSpaceData);
      vi.mocked(generateStoryblokTypes).mockResolvedValue(true);
      vi.mocked(generateTypes).mockResolvedValue("// Generated types");

      await typesCommand.parseAsync([
        "node",
        "test",
        "generate",
        "--space",
        "12345",
        "--custom-fields-parser",
        "/path/to/parser.ts",
      ]);

      expect(generateTypes).toHaveBeenCalledWith(
        mockSpaceData,
        expect.objectContaining({
          customFieldsParser: "/path/to/parser.ts",
        }),
      );
    });

    it("should pass compilerOptions option to generateTypes when --compiler-options flag is used", async () => {
      vi.mocked(readComponentsFiles).mockResolvedValue(mockSpaceData);
      vi.mocked(generateStoryblokTypes).mockResolvedValue(true);
      vi.mocked(generateTypes).mockResolvedValue("// Generated types");

      await typesCommand.parseAsync([
        "node",
        "test",
        "generate",
        "--space",
        "12345",
        "--compiler-options",
        "/path/to/options.json",
      ]);

      expect(generateTypes).toHaveBeenCalledWith(
        mockSpaceData,
        expect.objectContaining({
          compilerOptions: "/path/to/options.json",
        }),
      );
    });

    it("warns that the legacy generator is deprecated when --future-schema is absent", async () => {
      vi.mocked(readComponentsFiles).mockResolvedValue(mockSpaceData);
      vi.mocked(generateStoryblokTypes).mockResolvedValue(true);
      vi.mocked(generateTypes).mockResolvedValue("// Generated types");

      await typesCommand.parseAsync(["node", "test", "generate", "--space", "12345"]);

      expect(uiWarnMock).toHaveBeenCalledWith(expect.stringContaining("--future-schema"));
    });
  });

  describe("future-schema mode", () => {
    it("rejects legacy-only flags when --future-schema is used", async () => {
      await typesCommand.parseAsync([
        "node",
        "test",
        "generate",
        "--space",
        "295018",
        "--future-schema",
        "--strict",
      ]);

      expect(uiErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining("--strict") }),
        false,
      );
    });

    it("generates schema types and reports success, per-file output, and unmapped field types", async () => {
      vi.mocked(generateSchemaTypes).mockResolvedValue({
        files: ["/project/.storyblok/types/295018/storyblok-schema.d.ts"],
        prunedFiles: [],
        unmappedFieldTypes: ["storyblok-colorpicker"],
        fieldPlugins: {
          resolved: false,
          reason: "missing",
          path: "/project/.storyblok/schema/schema.ts",
        },
      });

      await typesCommand.parseAsync([
        "node",
        "test",
        "generate",
        "--space",
        "295018",
        "--future-schema",
      ]);

      expect(uiSpinnerSucceedMock).toHaveBeenCalled();
      expect(uiOkMock).toHaveBeenCalledWith(
        "/project/.storyblok/types/295018/storyblok-schema.d.ts",
      );
      expect(uiWarnMock).toHaveBeenCalledWith(expect.stringContaining("storyblok-colorpicker"));
      expect(uiInfoMock).toHaveBeenCalledWith(expect.stringContaining("@storyblok/schema"));
      expect(uiSpinnerFailedMock).not.toHaveBeenCalled();
    });

    it("points the unmapped-field-type warning at the module it read instead of the default path", async () => {
      vi.mocked(generateSchemaTypes).mockResolvedValue({
        files: ["/project/.storyblok/types/295018/storyblok-schema.d.ts"],
        prunedFiles: [],
        unmappedFieldTypes: ["storyblok-colorpicker"],
        fieldPlugins: { resolved: true, path: "/project/src/storyblok/field-plugins.ts" },
      });

      await typesCommand.parseAsync([
        "node",
        "test",
        "generate",
        "--space",
        "295018",
        "--future-schema",
      ]);

      expect(uiWarnMock).toHaveBeenCalledWith(
        expect.stringContaining("src/storyblok/field-plugins.ts"),
      );
      expect(uiWarnMock).not.toHaveBeenCalledWith(
        expect.stringContaining("--field-plugins at the module"),
      );
    });

    // `--path` moves the convention path, so naming the default would point the
    // user at a file they may already have.
    it("names the searched path, not the default, when no field-plugins module resolved", async () => {
      vi.mocked(generateSchemaTypes).mockResolvedValue({
        files: ["/project/config/types/295018/storyblok-schema.d.ts"],
        prunedFiles: [],
        unmappedFieldTypes: ["storyblok-colorpicker"],
        fieldPlugins: {
          resolved: false,
          reason: "missing",
          path: "/project/config/schema/schema.ts",
        },
      });

      await typesCommand.parseAsync([
        "node",
        "test",
        "generate",
        "--space",
        "295018",
        "--future-schema",
      ]);

      expect(uiWarnMock).toHaveBeenCalledWith(expect.stringContaining("config/schema/schema.ts"));
      expect(uiWarnMock).not.toHaveBeenCalledWith(
        expect.stringContaining(".storyblok/schema/schema.ts"),
      );
    });

    // `schema init` writes a `schema` export with no `fieldPlugins` key, so this
    // is the case a user following the docs hits first. Telling them to place a
    // module where one already sits reads as the command not seeing it.
    it("says the module at the convention path exports the wrong name, rather than telling the user to create it", async () => {
      vi.mocked(generateSchemaTypes).mockResolvedValue({
        files: ["/project/.storyblok/types/295018/storyblok-schema.d.ts"],
        prunedFiles: [],
        unmappedFieldTypes: ["storyblok-colorpicker"],
        fieldPlugins: {
          resolved: false,
          reason: "unusable",
          path: "/project/.storyblok/schema/schema.ts",
        },
      });

      await typesCommand.parseAsync([
        "node",
        "test",
        "generate",
        "--space",
        "295018",
        "--future-schema",
      ]);

      expect(uiWarnMock).toHaveBeenCalledWith(expect.stringContaining("exports neither"));
      expect(uiWarnMock).not.toHaveBeenCalledWith(expect.stringContaining("place it at"));
    });

    it("names a near-miss export the convention-path module should be renamed from", async () => {
      vi.mocked(generateSchemaTypes).mockResolvedValue({
        files: ["/project/.storyblok/types/295018/storyblok-schema.d.ts"],
        prunedFiles: [],
        unmappedFieldTypes: ["storyblok-colorpicker"],
        fieldPlugins: {
          resolved: false,
          reason: "unusable",
          path: "/project/.storyblok/schema/schema.ts",
          nearMissExport: "myPlugins",
        },
      });

      await typesCommand.parseAsync([
        "node",
        "test",
        "generate",
        "--space",
        "295018",
        "--future-schema",
      ]);

      expect(uiWarnMock).toHaveBeenCalledWith(expect.stringContaining("myPlugins"));
    });

    it("forwards --field-plugins, --type-prefix, --type-suffix, and --path to the generator", async () => {
      vi.mocked(generateSchemaTypes).mockResolvedValue({
        files: [],
        prunedFiles: [],
        unmappedFieldTypes: [],
        fieldPlugins: {
          resolved: false,
          reason: "missing",
          path: "/project/.storyblok/schema/schema.ts",
        },
      });

      await typesCommand.parseAsync([
        "node",
        "test",
        "generate",
        "--space",
        "295018",
        "--future-schema",
        "--field-plugins",
        "./src/storyblok/plugins.ts",
        "--type-prefix",
        "Sb",
        "--type-suffix",
        "Type",
      ]);

      expect(generateSchemaTypes).toHaveBeenCalledWith(
        expect.objectContaining({
          space: "295018",
          fieldPluginsPath: "./src/storyblok/plugins.ts",
          typePrefix: "Sb",
          typeSuffix: "Type",
        }),
      );
    });

    it.each(["storyblok-components", "storyblok-components.d.ts"])(
      "warns that --filename %s collides with the legacy generator output",
      async (filename) => {
        vi.mocked(generateSchemaTypes).mockResolvedValue({
          files: [],
          prunedFiles: [],
          unmappedFieldTypes: [],
          fieldPlugins: {
            resolved: false,
            reason: "missing",
            path: "/project/.storyblok/schema/schema.ts",
          },
        });

        await typesCommand.parseAsync([
          "node",
          "test",
          "generate",
          "--space",
          "295018",
          "--future-schema",
          "--filename",
          filename,
        ]);

        expect(uiWarnMock).toHaveBeenCalledWith(expect.stringContaining("--filename"));
      },
    );

    it("does not warn about a --filename the legacy generator never writes", async () => {
      vi.mocked(generateSchemaTypes).mockResolvedValue({
        files: [],
        prunedFiles: [],
        unmappedFieldTypes: [],
        fieldPlugins: {
          resolved: false,
          reason: "missing",
          path: "/project/.storyblok/schema/schema.ts",
        },
      });

      await typesCommand.parseAsync([
        "node",
        "test",
        "generate",
        "--space",
        "295018",
        "--future-schema",
        "--separate-files",
        "--filename",
        "shared",
      ]);

      expect(uiWarnMock).not.toHaveBeenCalledWith(expect.stringContaining("--filename"));
    });
  });
});
