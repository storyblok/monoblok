const ARM_SEPARATOR = "--";

export function caseIdFromKey(key: string): string {
  const variant = key.split("@")[1];
  if (!variant) throw new Error(`Scenario key "${key}" has no case variant`);
  return variant.split(ARM_SEPARATOR)[0];
}

export function variantName(caseId: string, arm: string): string {
  return `${caseId}${ARM_SEPARATOR}${arm}`;
}
