import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateStoryblokTypes, generateTypes } from "./actions";
// Import the main module first to ensure proper initialization
import "../index";
import { typesCommand } from "../command";
import { readComponentsFiles } from "../../components/push/actions";

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

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Successfully generated types for space"),
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
  });
});
