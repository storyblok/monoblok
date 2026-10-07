import { defineMigration, renameField } from "../../../index";

export default defineMigration({
  title: "Rename the card title",
  ops: [renameField({ block: "card", field: "title", to: "headline" })],
});
