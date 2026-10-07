import type { CommandOptions } from "../../../types";

export interface MigrationsGenerateOptions extends CommandOptions {
  suffix?: string;
  schema?: string;
  js?: boolean;
  before: boolean;
}
