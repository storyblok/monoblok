import { commands } from "../../constants";
import { addCrudVerbs, createCrudCommand } from "../../lib/crud";
import { getProgram } from "../../program";
import { webhooksResource } from "./resource";

export const webhooksCommand = createCrudCommand(getProgram(), {
  name: commands.WEBHOOKS,
  description: "Manage your space's webhooks",
});
addCrudVerbs(webhooksCommand, webhooksResource);
