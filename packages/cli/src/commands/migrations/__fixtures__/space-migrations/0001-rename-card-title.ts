import { defineMigration, renameField } from "@storyblok/schema/migrations";

export default defineMigration({
  title: "Rename the card title",
  ops: [renameField({ block: "card", field: "title", to: "headline" })],
});
