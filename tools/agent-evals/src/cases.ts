export type TestRunner = "vitest" | "vp" | "tsc";

export type BugCase = {
  id: string;
  issue: number;
  packageDir: string;
  packageName: string;
  fixRef: string;
  preFixRef: string;
  sourceFiles: string[];
  testFiles: string[];
  testSetupFiles: string[];
  testRunner: TestRunner;
  issueLabels: string[];
};

export const BUG_CASES: readonly BugCase[] = [
  {
    id: "cli-components-push-preview-tmpl",
    issue: 796,
    packageDir: "packages/cli",
    packageName: "storyblok",
    fixRef: "acfc0320a4726a603f3d8e87401fd55fb416e67f",
    preFixRef: "2743167ce98b239e9cd7e2e9a43b10de658f4076",
    sourceFiles: ["packages/cli/src/commands/components/push/actions.ts"],
    testFiles: ["packages/cli/src/commands/components/push/actions.test.ts"],
    testSetupFiles: [],
    testRunner: "vp",
    issueLabels: ["pkg: cli", "type: bug"],
  },
  {
    id: "cli-single-option-empty-type",
    issue: 668,
    packageDir: "packages/cli",
    packageName: "storyblok",
    fixRef: "cc727de0e1dffc668dea47493d6d2702ab6b5754",
    preFixRef: "27655202177eeaf51c4507e230a44b99bcaf6994",
    sourceFiles: ["packages/cli/src/commands/types/generate/actions.ts"],
    testFiles: ["packages/cli/src/commands/types/generate/actions.test.ts"],
    testSetupFiles: [],
    testRunner: "vitest",
    issueLabels: ["type: bug"],
  },
  {
    id: "js-client-strip-version-mapi",
    issue: 433,
    packageDir: "packages/js-client",
    packageName: "storyblok-js-client",
    fixRef: "58c4d295354285ecea1d0de9d6b7e0c0930d90f0",
    preFixRef: "5f5fcbe7a6bbaf7539b861542165fb99a2214e62",
    sourceFiles: ["packages/js-client/src/index.ts"],
    testFiles: ["packages/js-client/src/index.test.ts"],
    testSetupFiles: [],
    testRunner: "vp",
    issueLabels: ["pkg: storyblok-js-client", "type: bug"],
  },
  {
    id: "js-client-filter-query-brackets",
    issue: 32,
    packageDir: "packages/js-client",
    packageName: "storyblok-js-client",
    fixRef: "626ff0818f4c4add35ac819ef63a9ed991a056c1",
    preFixRef: "92e453cf33bd5dc529cd886045a79d828513981a",
    sourceFiles: ["packages/js-client/src/utils.ts"],
    testFiles: ["packages/js-client/src/utils.test.ts"],
    testSetupFiles: [],
    testRunner: "vitest",
    issueLabels: ["pkg: storyblok-js-client", "type: bug"],
  },
  {
    id: "react-rsc-bridge-exports",
    issue: 697,
    packageDir: "packages/react",
    packageName: "@storyblok/react",
    fixRef: "fb241b9c6a30abc850f6b47e21c68e41e8bf4228",
    preFixRef: "ea82a4edd0ea8e593955fe06b60cf3b31c40fe53",
    sourceFiles: ["packages/react/src/rsc/index.ts", "packages/react/src/types.ts"],
    testFiles: ["packages/react/src/__tests__/rsc-exports.test.ts"],
    testSetupFiles: ["packages/react/vitest.config.ts"],
    testRunner: "vitest",
    issueLabels: ["type: bug"],
  },
  {
    id: "richtext-vue-slot-warning",
    issue: 559,
    packageDir: "packages/richtext",
    packageName: "@storyblok/richtext",
    fixRef: "9ca09a142ad10698ff564bbef1db34c8a3870b86",
    preFixRef: "c8c45e9a343865fff2d5eb81974c08ad344b9856",
    sourceFiles: ["packages/richtext/src/richtext.ts"],
    testFiles: ["packages/richtext/src/richtext.test.ts"],
    testSetupFiles: [],
    testRunner: "vitest",
    issueLabels: ["type: bug"],
  },
  {
    id: "richtext-styled-link-shattered",
    issue: 525,
    packageDir: "packages/richtext",
    packageName: "@storyblok/richtext",
    fixRef: "fefe5023da364f39fc1f5bcc385ef12e7bb0dfdd",
    preFixRef: "c0602ec18784e4417768f622fa55e905eb4f9a97",
    sourceFiles: [
      "packages/richtext/src/richtext.ts",
      "packages/richtext/src/richtext-segment.ts",
      "packages/richtext/src/utils/index.ts",
    ],
    testFiles: ["packages/richtext/src/richtext.test.ts"],
    testSetupFiles: [],
    testRunner: "vitest",
    issueLabels: ["type: bug"],
  },
  {
    id: "astro-circular-dependency-tdz",
    issue: 547,
    packageDir: "packages/astro",
    packageName: "@storyblok/astro",
    fixRef: "1076a3a245f7de4e22fc0246de5d4ecfe95e5915",
    preFixRef: "f479038b620f957c9df0c082a0a48be2e982479f",
    sourceFiles: ["packages/astro/src/vite-plugins/vite-plugin-import-storyblok-components.ts"],
    testFiles: ["packages/astro/tests/vite-plugin-import-storyblok-components.test.ts"],
    testSetupFiles: [],
    testRunner: "vitest",
    issueLabels: ["pkg: astro", "type: bug"],
  },
];

export function bugCase(id: string): BugCase {
  const found = BUG_CASES.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown case "${id}"`);
  return found;
}

const shellQuote = (value: string): string => `'${value.replaceAll("'", `'\\''`)}'`;

/** Runs `files` (repo-relative) with the package's test runner, from the repo root. */
export function testCommand(c: BugCase, files: string[]): string {
  const relative = files.map((f) => shellQuote(f.slice(c.packageDir.length + 1))).join(" ");
  const run = c.testRunner === "vp" ? "vp test run" : "vitest run";
  return `pnpm --filter ${c.packageName} exec ${run} ${relative}`;
}
