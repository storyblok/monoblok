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

function parseNodes(inputPath: string): NodeEntry[] {
  const source = readFileSync(inputPath, "utf-8");
  const sf = ts.createSourceFile("types.gen.ts", source, ts.ScriptTarget.Latest, true);
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

  const entries: NodeEntry[] = [];

  for (const stmt of sf.statements) {
    if (!ts.isInterfaceDeclaration(stmt)) {
      continue;
    }
    const isExported = stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
    if (!isExported) {
      continue;
    }
    if (!stmt.name.text.startsWith("RichTextFieldValue")) {
      continue;
    }

    // Find type: 'literal'
    let typeValue: string | undefined;
    for (const m of stmt.members) {
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

    for (const m of stmt.members) {
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
      ifaceName: stmt.name.text,
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
  const nodes = parseNodes(inputPath);

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
