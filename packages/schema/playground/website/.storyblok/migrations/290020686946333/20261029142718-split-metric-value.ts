import { defineMigration, splitField } from "@storyblok/schema";

import type { Schema } from "../../../src/schema/schema.js";
import type { Before } from "./20261029142718-split-metric-value.before.js";

// "£2M+" → "£", "2", "M+"; "over 1000" → "over", "1000", "".
const METRIC = /^(\D*?)\s*(\d[\d,]*(?:\.\d+)?)\s*(.*)$/;

function splitMetric(value: string): [prefix: string, amount: string, suffix: string] {
  const match = METRIC.exec(value.trim());
  if (!match) {
    throw new Error(`metric value "${value}" holds no amount`);
  }
  const [, prefix, amount, suffix] = match;
  return [prefix, amount.replaceAll(",", ""), suffix];
}

export default defineMigration<Schema, Before>({
  title: "Split metric value into prefix, amount, and suffix",
  ops: [
    splitField(
      {
        block: "metric",
        field: "value",
        into: ["prefix", "amount", "suffix"],
        merge: ([prefix, amount, suffix]) => [prefix, amount, suffix].filter(Boolean).join(" "),
      },
      (value) => splitMetric(value ?? ""),
    ),
  ],
});
