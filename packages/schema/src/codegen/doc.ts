/**
 * A minimal pretty printer in the style of Wadler's "prettier printer", which
 * Prettier and Oxfmt build on, so generated source wraps the way formatted
 * source does. A group prints on one line when it fits and breaks every line
 * it directly contains otherwise.
 */
import { INDENT, propertyKey } from "./format";

export const PRINT_WIDTH = 100;

type Line = { type: "line"; soft?: true; hard?: true };
type Group = {
  type: "group";
  contents: Doc;
  /** Layouts tried in order, the last one broken, as for a call that hugs its last argument. */
  states?: readonly Doc[];
  shouldBreak?: boolean;
};
type Indent = { type: "indent"; contents: Doc };
type IfBreak = { type: "ifBreak"; broken: Doc; flat: Doc };

export type Doc = string | readonly Doc[] | Line | Group | Indent | IfBreak;

/** A space, or a line break when its group breaks. */
export const line: Doc = { type: "line" };
/** Nothing, or a line break when its group breaks. */
export const softline: Doc = { type: "line", soft: true };
/** Always a line break; breaks the groups around it. */
export const hardline: Doc = { type: "line", hard: true };

export function group(contents: Doc, options: { shouldBreak?: boolean } = {}): Doc {
  return { type: "group", contents, shouldBreak: options.shouldBreak };
}

/** Prints the first of `states` whose first line fits, or else the last one, broken. */
export function conditionalGroup(states: readonly Doc[]): Doc {
  return { type: "group", contents: states[0], states };
}

export function indent(contents: Doc): Doc {
  return { type: "indent", contents };
}

export function ifBreak(broken: Doc, flat: Doc = ""): Doc {
  return { type: "ifBreak", broken, flat };
}

/** Packs the words of `text` onto as few lines of at most `width` characters as they fit. */
export function wrapWords(text: string, width: number): string[] {
  const lines: string[] = [];
  for (const word of text.split(" ").filter(Boolean)) {
    const last = lines.length - 1;
    if (last >= 0 && lines[last].length + 1 + word.length <= width) {
      lines[last] += ` ${word}`;
    } else {
      lines.push(word);
    }
  }
  return lines;
}

export function join(separator: Doc, docs: readonly Doc[]): Doc[] {
  return docs.flatMap((doc, index) => (index === 0 ? [doc] : [separator, doc]));
}

function isConcat(doc: Doc): doc is readonly Doc[] {
  return Array.isArray(doc);
}

const hardlineCache = new WeakMap<object, boolean>();

/** A hard line break inside a group breaks it, but not past a conditional group. */
function containsHardline(doc: Doc): boolean {
  if (typeof doc === "string") return false;
  const cached = hardlineCache.get(doc);
  if (cached !== undefined) return cached;
  let result: boolean;
  if (isConcat(doc)) {
    result = doc.some(containsHardline);
  } else {
    const node = doc;
    switch (node.type) {
      case "line":
        result = node.hard === true;
        break;
      case "group":
        result = !node.states && containsHardline(node.contents);
        break;
      case "indent":
        result = containsHardline(node.contents);
        break;
      case "ifBreak":
        result = containsHardline(node.broken) || containsHardline(node.flat);
        break;
    }
  }
  hardlineCache.set(doc, result);
  return result;
}

function breaks(doc: Group): boolean {
  return doc.shouldBreak === true || (!doc.states && containsHardline(doc.contents));
}

type Mode = "flat" | "break";
type Command = { depth: number; mode: Mode; doc: Doc };

/**
 * Whether `next` fits in `width` columns up to its first line break, followed
 * by the commands still to print up to theirs.
 */
function fits(next: Command, rest: readonly Command[], width: number): boolean {
  const stack: { mode: Mode; doc: Doc }[] = [next];
  let restIndex = rest.length;
  let remaining = width;
  while (remaining >= 0) {
    const command = stack.pop() ?? (restIndex > 0 ? rest[--restIndex] : undefined);
    if (!command) return true;
    const { mode, doc } = command;
    if (typeof doc === "string") {
      remaining -= doc.length;
    } else if (isConcat(doc)) {
      for (let index = doc.length - 1; index >= 0; index--) stack.push({ mode, doc: doc[index] });
    } else {
      const node = doc;
      switch (node.type) {
        case "line":
          if (mode === "break" || node.hard) return true;
          remaining -= node.soft ? 0 : 1;
          break;
        case "group": {
          const groupMode = breaks(node) ? "break" : mode;
          const contents =
            node.states && groupMode === "break"
              ? node.states[node.states.length - 1]
              : node.contents;
          stack.push({ mode: groupMode, doc: contents });
          break;
        }
        case "indent":
          stack.push({ mode, doc: node.contents });
          break;
        case "ifBreak":
          stack.push({ mode, doc: mode === "break" ? node.broken : node.flat });
          break;
      }
    }
  }
  return false;
}

/** Prints `doc` starting at `depth` levels of indentation, with no indentation on its first line. */
export function printDoc(doc: Doc, depth = 0, width = PRINT_WIDTH): string {
  let output = "";
  let column = depth * INDENT.length;
  const commands: Command[] = [{ depth, mode: "break", doc }];
  while (commands.length > 0) {
    const { depth: level, mode, doc: current } = commands.pop()!;
    if (typeof current === "string") {
      output += current;
      column += current.length;
      continue;
    }
    if (isConcat(current)) {
      for (let index = current.length - 1; index >= 0; index--) {
        commands.push({ depth: level, mode, doc: current[index] });
      }
      continue;
    }
    const node = current;
    switch (node.type) {
      case "line":
        if (mode === "flat" && !node.hard) {
          const text = node.soft ? "" : " ";
          output += text;
          column += text.length;
        } else {
          output = `${output.replace(/[ \t]+$/, "")}\n${INDENT.repeat(level)}`;
          column = level * INDENT.length;
        }
        break;
      case "indent":
        commands.push({ depth: level + 1, mode, doc: node.contents });
        break;
      case "ifBreak":
        commands.push({ depth: level, mode, doc: mode === "break" ? node.broken : node.flat });
        break;
      case "group": {
        if (mode === "flat" && !breaks(node)) {
          commands.push({ depth: level, mode: "flat", doc: node.contents });
          break;
        }
        const remaining = width - column;
        if (!node.states) {
          const flat: Command = { depth: level, mode: "flat", doc: node.contents };
          commands.push(
            !breaks(node) && fits(flat, commands, remaining)
              ? flat
              : { depth: level, mode: "break", doc: node.contents },
          );
          break;
        }
        const tried = node.shouldBreak ? [] : node.states.slice(0, -1);
        const chosen = tried
          .map((state): Command => ({ depth: level, mode: "flat", doc: state }))
          .find((command) => fits(command, commands, remaining));
        commands.push(
          chosen ?? { depth: level, mode: "break", doc: node.states[node.states.length - 1] },
        );
        break;
      }
    }
  }
  return output;
}

export function objectDoc(entries: readonly [key: string, value: Doc][]): Doc {
  if (entries.length === 0) return "{}";
  const properties = entries.map(([key, value]) => [propertyKey(key), ": ", value]);
  return group(["{", indent([line, join([",", line], properties)]), ifBreak(","), line, "}"]);
}

/**
 * A call that breaks its arguments one per line when they don't fit. With
 * `hugLast`, an object or function as the last argument breaks first, keeping
 * the call's opening line, as in `renameField({` or `alterField(…, () => {`.
 */
export function callDoc(callee: string, args: readonly Doc[], hugLast = false): Doc {
  const brokenOut = [
    callee,
    "(",
    indent([softline, join([",", line], args)]),
    ifBreak(","),
    softline,
    ")",
  ];
  if (!hugLast) return group(brokenOut);
  const leading = args.slice(0, -1).flatMap((arg) => [arg, ", "]);
  return conditionalGroup([
    [callee, "(", join(", ", args), ")"],
    [callee, "(", ...leading, group(args[args.length - 1], { shouldBreak: true }), ")"],
    brokenOut,
  ]);
}
