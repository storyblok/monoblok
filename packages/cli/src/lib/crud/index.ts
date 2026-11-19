/**
 * Shared CRUD commands: a resource supplies its API calls, field descriptor,
 * secret fields and table columns, and gets `list`, `get`, `create`, `update`
 * and `delete`.
 */
export { addCrudCommand } from "./commands";
export type { CrudOperations, CrudResource, ResourceRecord } from "./types";
