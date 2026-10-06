const spaceId = process.env.STORYBLOK_SPACE_ID;

export default {
  // Needs a QA space from .env.qa-engineer-manual.
  skip: !spaceId,
  name: "Pull components and generate types",
  prompt: [
    `The Storyblok CLI (\`storyblok\` on PATH) is already logged in. Space ${spaceId} holds this project's components.`,
    "Pull the space's components into this project and generate TypeScript types for them.",
    "Then list the component names you found.",
  ].join(" "),
  setup: [{ action: "run_script", command: 'bash "$AXIS_CONFIG_DIR/scripts/login.sh"' }],
  judge: [
    { check: "Component schemas from the space exist as local files in the workspace", weight: 1 },
    {
      check: "A generated TypeScript declarations file with types for the pulled components exists",
      weight: 2,
    },
    { check: "The final answer names the components page, blog, hero, and cta", weight: 1 },
  ],
};
