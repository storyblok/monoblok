import { readFileSync } from "node:fs";
import ts from "typescript";

const CONTENT_PROP = "content";
const MARKS_PROP = "marks";

interface NodeEntry {
  typeValue: string;
  ifaceName: string;
  hasAttrs: boolean;
  attrsOptional: boolean;
  hasContent: boolean;
  contentOptional: boolean;
  hasMarks: boolean;
  marksOptional: boolean;
  extraProps: Array<{ name: string; optional: boolean; typeText: string }>;
}

/**
 * Object declarations the generator understands. `@hey-api/openapi-ts` emits
 * `export interface X { … }` in some versions and `export type X = { … }` in
 * others, so accept both shapes rather than tracking the generator's style.
 */
function readObjectDeclaration(
  stmt: ts.Statement,
): { name: string; members: ts.NodeArray<ts.TypeElement> } | undefined {
  const isExported = ts.canHaveModifiers(stmt)
    ? (ts.getModifiers(stmt)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false)
    : false;
  if (!isExported) {
    return undefined;
  }

  if (ts.isInterfaceDeclaration(stmt)) {
    return { name: stmt.name.text, members: stmt.members };
  }
  if (ts.isTypeAliasDeclaration(stmt) && ts.isTypeLiteralNode(stmt.type)) {
    return { name: stmt.name.text, members: stmt.type.members };
  }
  return undefined;
}

function parseNodes(source: string): NodeEntry[] {
  const sf = ts.createSourceFile("types.gen.ts", source, ts.ScriptTarget.Latest, true);
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

  const entries: NodeEntry[] = [];

  for (const stmt of sf.statements) {
    const declaration = readObjectDeclaration(stmt);
    if (!declaration) {
      continue;
    }
    if (!declaration.name.startsWith("RichTextFieldValue")) {
      continue;
    }

    // Find type: 'literal'
    let typeValue: string | undefined;
    for (const m of declaration.members) {
      if (
        ts.isPropertySignature(m) &&
        m.name &&
        ts.isIdentifier(m.name) &&
        m.name.text === "type" &&
        m.type &&
        ts.isLiteralTypeNode(m.type) &&
        ts.isStringLiteral(m.type.literal)
      ) {
        typeValue = m.type.literal.text;
        break;
      }
    }
    if (!typeValue) {
      continue;
    }

    let hasAttrs = false;
    let attrsOptional = false;
    let hasContent = false;
    let contentOptional = false;
    let hasMarks = false;
    let marksOptional = false;
    const extraProps: NodeEntry["extraProps"] = [];

    for (const m of declaration.members) {
      if (!ts.isPropertySignature(m) || !m.name || !ts.isIdentifier(m.name)) {
        continue;
      }
      const prop = m.name.text;
      const optional = !!m.questionToken;

      if (prop === "type") {
        continue;
      }

      if (prop === "attrs") {
        hasAttrs = true;
        attrsOptional = optional;
      } else if (prop === CONTENT_PROP) {
        hasContent = true;
        contentOptional = optional;
      } else if (prop === MARKS_PROP) {
        hasMarks = true;
        marksOptional = optional;
      } else if (m.type) {
        extraProps.push({
          name: prop,
          optional,
          typeText: printer.printNode(ts.EmitHint.Unspecified, m.type, sf),
        });
      }
    }

    entries.push({
      typeValue,
      ifaceName: declaration.name,
      hasAttrs,
      attrsOptional,
      hasContent,
      contentOptional,
      hasMarks,
      marksOptional,
      extraProps,
    });
  }

  return entries;
}

export function generateElementTypes(inputPath: string): string {
  return generateElementTypesFromSource(readFileSync(inputPath, "utf-8"), inputPath);
}

export function generateElementTypesFromSource(
  source: string,
  sourceName = "types.gen.ts",
): string {
  const nodes = parseNodes(source);

  // Without this the generator writes an empty `StoryblokRichTextElementByType`
  // and exits successfully, which only surfaces much later as a type error in a
  // consumer package.
  if (nodes.length === 0) {
    throw new Error(
      `No exported RichTextFieldValue* object declarations found in ${sourceName}. The generated element types would be empty.`,
    );
  }

  // Import only the interfaces that have attrs (we reference their ['attrs'] type)
  const ifaceImports = nodes
    .filter((n) => n.hasAttrs)
    .map((n) => n.ifaceName)
    .sort();

  const lines: string[] = [
    "// THIS FILE IS AUTO-GENERATED. DO NOT EDIT.",
    "",
    `import type { RichTextMark, RichTextNode, ${ifaceImports.join(", ")} } from '../generated/overlay/types.gen';`,
    "",
  ];

  // ── SbRichTextElementByType ───────────────────────────────────────────────
  lines.push("export interface StoryblokRichTextElementByType<TContext = unknown> {");
  for (const n of nodes) {
    lines.push(`  ${n.typeValue}: {`);
    lines.push(`    type: '${n.typeValue}';`);

    if (n.hasAttrs) {
      const opt = n.attrsOptional ? "?" : "";
      lines.push(`    attrs${opt}: ${n.ifaceName}['attrs'];`);
    }

    for (const p of n.extraProps) {
      lines.push(`    ${p.name}${p.optional ? "?" : ""}: ${p.typeText};`);
    }

    if (n.hasContent) {
      lines.push(`    content${n.contentOptional ? "?" : ""}: RichTextNode[];`);
    }
    if (n.hasMarks) {
      lines.push(`    marks${n.marksOptional ? "?" : ""}: RichTextMark[];`);
    }

    lines.push("    _key?: string;");
    lines.push("    context?: TContext;");
    lines.push("  };");
  }
  lines.push("}", "");

  return lines.join("\n");
}
