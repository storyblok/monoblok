import { describe, expect, it } from "vitest";
import {
  getAssetFilename,
  getAssetNameAndExt,
  getComponentFilename,
  getDatasourceFilename,
  getStoryFilename,
  sanitizeFilename,
} from ".";

describe("sanitizeFilename", () => {
  it("should replace characters that are not allowed in file names with underscores", () => {
    expect(sanitizeFilename("Country / Currency")).toBe("Country _ Currency");
    expect(sanitizeFilename("path/to/file")).toBe("path_to_file");
  });

  it("should keep characters that are allowed in file names", () => {
    expect(sanitizeFilename("My Component Name")).toBe("My Component Name");
    expect(sanitizeFilename("Special@Characters!")).toBe("Special@Characters!");
  });
});

describe("getStoryFilename", () => {
  it("should combine slug and uuid", () => {
    expect(getStoryFilename({ slug: "about-us", uuid: "abc-123" })).toBe("about-us_abc-123.json");
  });

  it("should keep a traversing slug inside a single path segment", () => {
    expect(getStoryFilename({ slug: "../../etc/passwd", uuid: "abc-123" })).toBe(
      "..-..-etc-passwd_abc-123.json",
    );
  });

  it("should keep a traversing uuid inside a single path segment", () => {
    expect(getStoryFilename({ slug: "about-us", uuid: "../../../evil" })).toBe(
      "about-us_..-..-..-evil.json",
    );
  });

  it("should preserve consecutive hyphens so the file round-trips to the story", () => {
    expect(getStoryFilename({ slug: "summer--sale", uuid: "abc-123" })).toBe(
      "summer--sale_abc-123.json",
    );
  });
});

describe("getAssetFilename", () => {
  it("should combine the short file name without extension and the id", () => {
    expect(getAssetFilename({ id: 101, short_filename: "hero-image.jpg" })).toBe(
      "hero-image_101.json",
    );
  });

  it("should fall back to the basename of the file URL", () => {
    expect(
      getAssetFilename({ id: 101, filename: "https://a.storyblok.com/f/1/1920x1080/hero.jpg" }),
    ).toBe("hero_101.json");
  });

  it("should sanitize characters that are not allowed in file names", () => {
    expect(getAssetFilename({ id: 7, short_filename: "a:b?.png" })).toBe("a_b__7.json");
  });

  it("should throw when the asset has no file name", () => {
    expect(() => getAssetFilename({ id: 7 })).toThrow(
      "Filename for asset with id 7 could not be determined!",
    );
  });
});

describe("getAssetNameAndExt", () => {
  it("should split the file name into a sanitized name and its extension", () => {
    expect(getAssetNameAndExt({ id: 1, short_filename: "my/photo.webp" })).toEqual({
      name: "my_photo",
      ext: ".webp",
    });
  });
});

describe("getComponentFilename", () => {
  it("should use the sanitized component name", () => {
    expect(getComponentFilename({ name: "hero/teaser" })).toBe("hero_teaser.json");
  });

  it("should insert the suffix before the extension", () => {
    expect(getComponentFilename({ name: "hero" }, "dev")).toBe("hero.dev.json");
  });
});

describe("getDatasourceFilename", () => {
  it("should use the sanitized datasource name", () => {
    expect(getDatasourceFilename({ name: "Country / Currency" })).toBe("Country _ Currency.json");
  });

  it("should insert the suffix before the extension", () => {
    expect(getDatasourceFilename({ name: "Colors" }, "dev")).toBe("Colors.dev.json");
  });
});
