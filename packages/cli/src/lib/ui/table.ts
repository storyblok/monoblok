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

const truncate = (text: string, width: number): string =>
  text.length <= width ? text : `${text.slice(0, Math.max(0, width - 1))}${ELLIPSIS}`;

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
  // Cells come from story data, so a newline or tab would break the layout.
  const cells = rows.map((row) => row.map((cell) => cell.replace(/\s+/g, " ")));
  const widths = columns.map((column, index) =>
    Math.max(column.header.length, ...cells.map((row) => row[index].length)),
  );

  const flexible = columns.findIndex((column) => column.flexible);
  if (width && flexible !== -1) {
    const total = widths.reduce((sum, w) => sum + w, 0) + GAP.length * (columns.length - 1);
    const overflow = total - width;
    if (overflow > 0) {
      widths[flexible] = Math.max(MIN_FLEXIBLE_WIDTH, widths[flexible] - overflow);
    }
  }

  const line = (row: string[], style: (text: string) => string = (text) => text): string =>
    row
      .map((cell, index) => {
        const text = truncate(cell, widths[index]);
        // Padded before styling: escape codes have no width on screen.
        return style(index === row.length - 1 ? text : text.padEnd(widths[index]));
      })
      .join(GAP);

  const header = line(
    columns.map((column) => column.header.toUpperCase()),
    (text) => chalk.bold(text),
  );
  return [header, ...cells.map((row) => line(row))].join("\n");
}
