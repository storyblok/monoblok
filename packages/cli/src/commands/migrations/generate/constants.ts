import type { CommandOptions } from "../../../types";

export interface MigrationsGenerateOptions extends CommandOptions {
  suffix?: string;
  schema?: string;
  legacy?: boolean;
  before: boolean;
}
