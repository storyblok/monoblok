export interface SchemaInitOptions {
  outDir: string;
  /** Extra plugin option names to treat as secrets, on top of the defaults. */
  secretNames?: string[];
  /** Whether sensitive plugin option values are replaced with `secret()` placeholders. */
  redactSecrets: boolean;
}
