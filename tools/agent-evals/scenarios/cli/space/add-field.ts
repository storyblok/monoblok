const spaceId = process.env.STORYBLOK_SPACE_ID;

export default {
  // Needs a QA space from .env.qa-engineer-manual.
  skip: !spaceId,
  name: "Add a field to an existing component",
  prompt: [
    `The Storyblok CLI (\`storyblok\` on PATH) is already logged in to space ${spaceId}.`,
    "Add a required text field named `subtitle` to the space's existing `hero` component, keeping its current fields.",
    "Apply the change to the space and confirm it landed.",
  ].join(" "),
  setup: [{ action: "run_script", command: 'bash "$AXIS_CONFIG_DIR/scripts/login.sh"' }],
  teardown: [
    { action: "run_script", command: 'bash "$AXIS_CONFIG_DIR/scripts/verify-component.sh" hero' },
  ],
  judge: [
    {
      check: "The `hero` component in the space was updated with a `subtitle` field of type text",
      weight: 2,
    },
    { check: "The `subtitle` field is marked required", weight: 1 },
    { check: "The existing fields of `hero` were preserved", weight: 1 },
    { check: "The agent verified the change against the space after applying it", weight: 1 },
  ],
};
