import { describe, expect, it } from "vitest";

import { toDeclarationFileName, toDeclarationImportSpecifier } from "./filename";

describe("toDeclarationFileName", () => {
  it("appends the declaration extension to a base name", () => {
    expect(toDeclarationFileName("storyblok-components")).toBe("storyblok-components.d.ts");
  });

  it("does not double an extension the user already spelled out", () => {
    expect(toDeclarationFileName("my-types.d.ts")).toBe("my-types.d.ts");
  });

  it("leaves an unrelated extension alone, since it is part of the name", () => {
    expect(toDeclarationFileName("my-types.generated")).toBe("my-types.generated.d.ts");
  });
});

describe("toDeclarationImportSpecifier", () => {
  it("names the output module of the declaration file written for a base name", () => {
    expect(toDeclarationImportSpecifier("hero")).toBe("hero.js");
  });

  // An extension-less specifier is TS2834 under node16/node18/nodenext in an ESM
  // package, and this is generated code the user cannot repair by hand.
  it("never returns an extension-less specifier", () => {
    for (const baseName of ["hero", "teaser-list", "2-col", "my-types.d.ts"]) {
      expect(toDeclarationImportSpecifier(baseName)).toMatch(/\.js$/);
    }
  });

  it("pairs with toDeclarationFileName rather than appending to its output", () => {
    expect(toDeclarationImportSpecifier("hero.d.ts")).toBe("hero.js");
    expect(toDeclarationImportSpecifier(toDeclarationFileName("hero"))).toBe("hero.js");
  });

  it("leaves an unrelated extension alone, since it is part of the name", () => {
    expect(toDeclarationImportSpecifier("my-types.generated")).toBe("my-types.generated.js");
  });
});
