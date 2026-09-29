const hasQaSpace = Boolean(process.env.STORYBLOK_SPACE_ID);

export default {
  scenarios: "./scenarios",
  agents: ["claude-code"],
  // Not a secret; scenario setup/teardown scripts need it.
  env: ["STORYBLOK_SPACE_ID"],
  settings: {
    // Space scenarios share one QA space and must not overlap.
    concurrency: 1,
    limits: {
      scenario: { time_minutes: 10 },
    },
  },
  beforeAll: hasQaSpace
    ? [{ action: "run_script", command: "bash ./scripts/seed.sh has-stories" }]
    : [],
};
