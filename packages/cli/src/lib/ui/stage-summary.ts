import chalk from "chalk";

/** A secondary count next to a stage's result. A zero is left out. */
export interface StageNote {
  count: number;
  /** What the count is of, singular and plural: `["page failed", "pages failed"]`. */
  text: string | [singular: string, plural: string];
  /** A failure is printed in red, and marks its stage as failed. */
  failure?: boolean;
}

export interface SummaryStage {
  label: string;
  /** The stage's headline figure, e.g. `210 listed`. */
  result: string;
  notes?: StageNote[];
  /** How long the stage was busy, already formatted. */
  duration: string;
}

const GAP = "  ";
const SEPARATOR = " · ";

const noteText = ({ count, text }: StageNote): string => {
  const [singular, plural] = typeof text === "string" ? [text, text] : text;
  return `${count} ${count === 1 ? singular : plural}`;
};

/**
 * Lays out the closing summary of a staged run: a headline with the run's
 * wall-clock time, then one row per stage with what it produced and how long it
 * was busy.
 *
 * The run's time lives in the headline rather than under the stages because the
 * stages overlap: a total at the foot of their column would read as their sum.
 * Stage times are dimmed for the same reason, as detail rather than figures to
 * add up.
 *
 * Only counts that are not zero are printed, so a clean run reads as just its
 * results. A stage with a failure gets a red mark in the gutter, so it stands
 * out without every other row carrying a mark of its own.
 */
export function renderRunSummary({
  headline,
  duration,
  qualifier,
  failed = false,
  stages,
}: {
  /** What the run produced, e.g. `Found 210 stories`. */
  headline: string;
  /** The run's wall-clock time, already formatted. */
  duration: string;
  /** A short aside on how to read the result, e.g. `metadata only`. */
  qualifier?: string;
  /** The result is incomplete. */
  failed?: boolean;
  stages: SummaryStage[];
}): string[] {
  const mark = failed ? chalk.red("✖") : chalk.green("✔");
  const aside = qualifier ? chalk.dim(` (${qualifier})`) : "";
  const lines = [`${mark} ${headline} in ${duration}${aside}`];
  if (stages.length === 0) {
    return lines;
  }

  const rows = stages.map((stage) => {
    const notes = (stage.notes ?? []).filter((note) => note.count > 0);
    return {
      failed: notes.some((note) => note.failure),
      label: stage.label,
      plain: [stage.result, ...notes.map(noteText)].join(SEPARATOR),
      styled: [
        stage.result,
        ...notes.map((note) =>
          note.failure ? chalk.red(noteText(note)) : chalk.dim(noteText(note)),
        ),
      ].join(chalk.dim(SEPARATOR)),
      duration: stage.duration,
    };
  });

  const labelWidth = Math.max(...rows.map((row) => row.label.length));
  const resultWidth = Math.max(...rows.map((row) => row.plain.length));
  const durationWidth = Math.max(...rows.map((row) => row.duration.length));

  lines.push("");
  for (const row of rows) {
    const gutter = row.failed ? chalk.red("✖") : " ";
    // Padded before styling: escape codes have no width on screen.
    const result = `${row.styled}${" ".repeat(resultWidth - row.plain.length)}`;
    const duration = chalk.dim(row.duration.padStart(durationWidth));
    lines.push(`${gutter} ${row.label.padEnd(labelWidth)}${GAP}${result}${GAP}${duration}`);
  }
  return lines;
}
