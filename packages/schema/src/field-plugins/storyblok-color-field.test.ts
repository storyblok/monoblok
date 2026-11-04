import { describe, expect, it } from "vitest";
import { storyblokColorField } from "./storyblok-color-field";

describe("storyblokColorField", () => {
  it("should register the storyblok-colorpicker field type", () => {
    expect(storyblokColorField.fieldType).toBe("storyblok-colorpicker");
  });

  it.each(["#ffffff", ""])(
    "should accept a value with color %j and its plugin discriminator",
    async (color) => {
      const value = { plugin: "official-colorpicker", color };
      const result = await storyblokColorField.value["~standard"].validate(value);
      expect(result).toEqual({ value });
    },
  );

  it.each([undefined, null, "storyblok-colorpicker", 42])(
    "should reject an invalid plugin discriminator: %j",
    async (plugin) => {
      const result = await storyblokColorField.value["~standard"].validate({
        plugin,
        color: "#ffffff",
      });
      expect(result).toHaveProperty("issues", [expect.objectContaining({ path: ["plugin"] })]);
    },
  );

  it("should report an issue for a malformed color", async () => {
    const result = await storyblokColorField.value["~standard"].validate({
      plugin: "official-colorpicker",
      color: 123,
    });
    expect(result).toHaveProperty("issues", [expect.objectContaining({ path: ["color"] })]);
  });
});
