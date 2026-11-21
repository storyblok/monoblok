export default {
  name: "Define and validate a code-driven schema",
  prompt: [
    "This is an empty directory for a new Storyblok project.",
    "Using the Storyblok CLI (`storyblok` is on PATH), define the space's schema in TypeScript:",
    "an `article` content type with a required `title` text field, a `body` rich text field,",
    "and a `tags` multi-options field with the options news, guide, and release.",
    "Then validate the schema with the CLI. Do not log in or contact a Storyblok space.",
  ].join(" "),
  judge: [
    {
      check: "A TypeScript schema file defines an `article` component marked as a content type",
      weight: 2,
    },
    { check: "`article` has a `title` text field marked required", weight: 1 },
    { check: "`article` has a `body` rich text field", weight: 1 },
    {
      check: "`article` has a `tags` multi-options field with the options news, guide, and release",
      weight: 1,
    },
    {
      check: "Running `storyblok schema validate` on the entry file exits successfully",
      weight: 2,
    },
  ],
};
