/**
 * Validates and converts a string or number space ID to a number
 * @param spaceId - The space ID as string or number
 * @returns The space ID as number if valid, undefined otherwise
 * @description
 * Reusable utility that validates and converts space IDs from various input types.
 * Handles string validation, whitespace trimming, and safe integer checks.
 * @example
 * ```ts
 * validateSpaceId("1212434") // 1212434
 * validateSpaceId("asfdasd") // undefined
 * validateSpaceId(1212434) // 1212434
 * validateSpaceId("  123  ") // 123
 * validateSpaceId("12.34") // undefined
 * ```
 */
export function validateSpaceId(spaceId: unknown): number | undefined {
  if (typeof spaceId !== 'number' && typeof spaceId !== 'string') {
    return undefined
  }

  const spaceIdAsNumber =
    typeof spaceId === 'string' ? parseNumericString(spaceId) : Number(spaceId)

  if (
    spaceIdAsNumber !== undefined &&
    spaceIdAsNumber >= 0 &&
    Number.isInteger(spaceIdAsNumber) &&
    Number.isSafeInteger(spaceIdAsNumber)
  ) {
    return spaceIdAsNumber
  }

  // Reject all other types
  return undefined
}

function parseNumericString(numberAsString: string) {
  const trimmedNumber = numberAsString.trim()

  // Check for empty string
  if (trimmedNumber === '') {
    return undefined
  }

  // Check if string contains only digits
  if (!/^\d+$/.test(trimmedNumber)) {
    return undefined
  }

  return Number(trimmedNumber)
}
