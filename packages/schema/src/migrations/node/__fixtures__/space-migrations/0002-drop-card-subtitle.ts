import { defineMigration, removeField } from "../../../index";

export default defineMigration([removeField({ block: "card", field: "subtitle" })]);
