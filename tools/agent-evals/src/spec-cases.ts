export type SpecCase = {
  id: string;
  pr: number;
  preFixRef: string;
  fixRef: string;
  packageName: string;
  /** One-sentence shipped contract, kept consistent with the brief's `## Decisions`. */
  shipped: string;
};

export const SPEC_CASES: readonly SpecCase[] = [
  {
    id: "cli-stories-validate",
    pr: 737,
    preFixRef: "260066647eb1022ed29d1971eb9208ebcd09f2bd",
    fixRef: "34551be43b0a4e72d792bfdbb4c9f725aeceebb0",
    packageName: "storyblok",
    shipped:
      "`storyblok stories validate` streams every story and validates its draft content against the local schema, with `--starts-with`, `--level` and `--format`, exit code 2 on failures, field-level translations validated, out-of-options values reported and space-sourced options skipped.",
  },
  {
    id: "richtext-context-data",
    pr: 674,
    preFixRef: "8251d2ccde3c5e600e33fce861ae9be6050721ae",
    fixRef: "32f13b1cfb72629753ace3478c4846b1289fd697",
    packageName: "@storyblok/richtext",
    shipped:
      "A `data` prop on the rich text component reaches custom components as `context`, nested rich text in a custom component excludes its own component type automatically, custom `text` nodes are supported and mark components receive `context`, in every framework package and the core.",
  },
];
