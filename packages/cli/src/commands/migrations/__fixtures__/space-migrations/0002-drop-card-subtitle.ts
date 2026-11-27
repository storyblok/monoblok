import { defineMigration, removeField } from "@storyblok/schema/migrations";

export default defineMigration([removeField({ block: "card", field: "subtitle" })]);
