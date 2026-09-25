/**
 * A table field is one value holding two parallel structures: a header row and
 * a body whose every row has to keep the same number of cells. Adding a column
 * means writing into both, and getting it wrong produces a table the editor
 * renders ragged rather than an error anyone sees.
 *
 * What makes the row repeatable is the guard: a table that already carries the
 * column is returned untouched, so a second run has nothing to do and cannot
 * disagree with the first.
 *
 * The cell ids are derived from the row rather than generated because a
 * migration should produce the same content twice. The engine would not catch a
 * random one: its agreement check only looks at what the op does to a block it
 * is applied to twice, and the guard makes the second pass a no-op before two
 * different results can exist. What catches it is the expected snapshot beside
 * this catalogue, which is a different kind of check and the reason to keep one.
 */
import { alterField, defineMigration } from "@storyblok/schema/migrations";

import type { Schema } from "../src/schema/schema";

const COLUMN = "Support";
const DEFAULT_CELL = "Included";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cell(uid: string, value: string): Record<string, unknown> {
  return { _uid: `${uid}-support`, value };
}

export default defineMigration<Schema>({
  title: "Add a Support column to the pricing table",
  ops: [
    alterField({ block: "pricing_table", field: "table" }, (table) => {
      if (!isRecord(table) || !Array.isArray(table.thead) || !Array.isArray(table.tbody)) {
        return table;
      }
      const alreadyAdded = table.thead.some((head) => isRecord(head) && head.value === COLUMN);
      if (alreadyAdded || table.thead.length === 0) {
        return table;
      }

      const firstHead = table.thead[0];
      const headUid =
        isRecord(firstHead) && typeof firstHead._uid === "string" ? firstHead._uid : COLUMN;

      return {
        ...table,
        thead: [...table.thead, cell(headUid, COLUMN)],
        tbody: table.tbody.map((row) => {
          if (!isRecord(row) || !Array.isArray(row.body) || typeof row._uid !== "string") {
            return row;
          }
          return { ...row, body: [...row.body, cell(row._uid, DEFAULT_CELL)] };
        }),
      };
    }),
  ],
});
