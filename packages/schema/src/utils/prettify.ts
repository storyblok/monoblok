/**
 * Flattens an intersection type into a single object type for readable IDE display.
 * @example Prettify<{ a: string } & { b: number }> → { a: string; b: number }
 */
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};
