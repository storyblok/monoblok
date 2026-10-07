import chalk from "chalk";

export interface TableColumn<T> {
  header: string;
  value: (record: T) => string;
  /**
   * Truncated to fit the terminal when the table is wider than it. Only one
   * column should be: the one a reader can most afford to lose the end of.
   */
  flexible?: boolean;
}

const GAP = "  ";
const ELLIPSIS = "…";
/** A flexible column never shrinks below this, however narrow the terminal. */
const MIN_FLEXIBLE_WIDTH = 10;

const graphemes = new Intl.Segmenter();

/** Combining marks and invisible format characters take no column of their own. */
const ZERO_WIDTH = /^[\p{Mark}\p{Default_Ignorable_Code_Point}]+$/u;
/** Emoji drawn as pictures, and flags (a pair of regional indicators). */
const EMOJI = /\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F|\p{Regional_Indicator}/u;
/**
 * The East Asian Wide and Fullwidth blocks a story name realistically holds:
 * Hangul, CJK punctuation, kana, ideographs, Yi, and fullwidth forms. Not the
 * complete Unicode table, which would be a dependency's worth of data for
 * characters that never turn up in a name.
 */
const WIDE =
  /^[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uA960-\uA97F\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE19\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6\u{1B000}-\u{1B2FF}\u{20000}-\u{3FFFD}]/u;

/** How many terminal columns one grapheme takes: 0, 1, or 2. */
function graphemeWidth(grapheme: string): number {
  if (ZERO_WIDTH.test(grapheme)) {
    return 0;
  }
  return EMOJI.test(grapheme) || WIDE.test(grapheme) ? 2 : 1;
}

/**
 * How many terminal columns text takes, which is neither `.length` (UTF-16
 * code units, so an emoji counts as 2 and a combining accent as 1) nor the
 * code point count (an ideograph takes two columns).
 */
function textWidth(text: string): number {
  let width = 0;
  for (const { segment } of graphemes.segment(text)) {
    width += graphemeWidth(segment);
  }
  return width;
}

/**
 * Cuts text to `width` terminal columns, never inside a grapheme: a CJK
 * character takes two columns, and an emoji is several code units.
 */
function truncate(text: string, width: number): string {
  if (textWidth(text) <= width) {
    return text;
  }
  const budget = Math.max(0, width - 1);
  let kept = "";
  let used = 0;
  for (const { segment } of graphemes.segment(text)) {
    const segmentWidth = graphemeWidth(segment);
    if (used + segmentWidth > budget) {
      break;
    }
    kept += segment;
    used += segmentWidth;
  }
  return `${kept}${ELLIPSIS}`;
}

/**
 * Makes a cell safe to print. Cells come from story data: a newline or tab
 * would break the layout, and a control character would reach the terminal as
 * a command (an escape sequence can recolor, move the cursor over another row,
 * or set the window title), so it is shown as `�` instead.
 */
const sanitize = (cell: string): string =>
  // oxlint-disable-next-line no-control-regex -- matching control characters is the point.
  cell.replace(/\s+/g, " ").replace(/[\u0000-\u001f\u007f-\u009f]/g, "\uFFFD");

/**
 * Lays rows out as aligned columns, `gh issue list` style: an upper-case bold
 * header, two spaces between columns, and no trailing padding.
 *
 * When `width` is given and the table is wider, the flexible column gives up
 * the difference. Every other cell is printed whole, because an id or a slug
 * cut short cannot be copied back into another command.
 */
export function renderTable<T>({
  columns,
  rows,
  width,
}: {
  columns: TableColumn<T>[];
  rows: string[][];
  width?: number;
}): string {
  const cells = rows.map((row) => row.map(sanitize));
  // A loop rather than `Math.max(...)`, which takes one argument per row and
  // overflows the call stack on a result set of a hundred thousand stories.
  const widths = columns.map((column) => column.header.length);
  for (const row of cells) {
    row.forEach((cell, index) => {
      widths[index] = Math.max(widths[index], textWidth(cell));
    });
  }

  const flexible = columns.findIndex((column) => column.flexible);
  if (width && flexible !== -1) {
    const total = widths.reduce((sum, w) => sum + w, 0) + GAP.length * (columns.length - 1);
    const overflow = total - width;
    if (overflow > 0) {
      // Never below the minimum, and never wider than the column already is.
      const floor = Math.min(MIN_FLEXIBLE_WIDTH, widths[flexible]);
      widths[flexible] = Math.max(floor, widths[flexible] - overflow);
    }
  }

  const line = (row: string[], style: (text: string) => string = (text) => text): string =>
    row
      .map((cell, index) => {
        const text = truncate(cell, widths[index]);
        // Padded before styling: escape codes have no width on screen.
        const padding = " ".repeat(Math.max(0, widths[index] - textWidth(text)));
        return style(index === row.length - 1 ? text : `${text}${padding}`);
      })
      .join(GAP);

  const header = line(
    columns.map((column) => column.header.toUpperCase()),
    (text) => chalk.bold(text),
  );
  return [header, ...cells.map((row) => line(row))].join("\n");
}
