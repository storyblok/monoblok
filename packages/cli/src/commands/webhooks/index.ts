import { commands } from "../../constants";
import { addCrudCommand } from "../../lib/crud";
import { getProgram } from "../../program";
import { webhooksResource } from "./resource";

export const webhooksCommand = addCrudCommand(getProgram(), {
  name: commands.WEBHOOKS,
  description: "Manage your space's webhooks",
  resource: webhooksResource,
});
