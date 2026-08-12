import { describe, expect, it } from "vitest";
import { generateElementTypesFromSource } from "./richtext-element-types";

const asInterfaces = `
export interface RichTextFieldValueParagraphNode {
  type: 'paragraph';
  attrs?: {
    textAlign: 'left' | 'center' | 'right' | 'justify' | null;
  };
  content?: Array<RichTextFieldValueRichTextNode>;
  marks?: Array<RichTextFieldValueMark>;
}

export interface RichTextFieldValueTextNode {
  type: 'text';
  text: string;
  marks?: Array<RichTextFieldValueMark>;
}
`;

const asTypeAliases = `
export type RichTextFieldValueParagraphNode = {
  type: 'paragraph';
  attrs?: {
    textAlign: 'left' | 'center' | 'right' | 'justify' | null;
  };
  content?: Array<RichTextFieldValueRichTextNode>;
  marks?: Array<RichTextFieldValueMark>;
};

export type RichTextFieldValueTextNode = {
  type: 'text';
  text: string;
  marks?: Array<RichTextFieldValueMark>;
};
`;

describe("generateElementTypesFromSource", () => {
  it("should map interface declarations to element types", () => {
    const result = generateElementTypesFromSource(asInterfaces);

    expect(result).toContain(
      "export interface StoryblokRichTextElementByType<TContext = unknown> {",
    );
    expect(result).toContain("paragraph: {");
    expect(result).toContain("attrs?: RichTextFieldValueParagraphNode['attrs'];");
    expect(result).toContain("content?: RichTextNode[];");
    expect(result).toContain("text: {");
    expect(result).toContain("text: string;");
  });

  it("should map type alias declarations the same way as interfaces", () => {
    expect(generateElementTypesFromSource(asTypeAliases)).toBe(
      generateElementTypesFromSource(asInterfaces),
    );
  });

  it("should ignore declarations outside the RichTextFieldValue namespace", () => {
    const result = generateElementTypesFromSource(
      `${asInterfaces}\nexport type SomethingElse = { type: 'other' };\n`,
    );

    expect(result).not.toContain("other: {");
  });

  it("should ignore declarations that are not exported", () => {
    const result = generateElementTypesFromSource(
      `${asInterfaces}\ntype RichTextFieldValueInternalNode = { type: 'internal' };\n`,
    );

    expect(result).not.toContain("internal: {");
  });

  it("should throw instead of emitting an empty element type map", () => {
    expect(() =>
      generateElementTypesFromSource("export type Unrelated = { a: string };", "types.gen.ts"),
    ).toThrow(/would be empty/);
  });
});
