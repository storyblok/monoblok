import { fileURLToPath } from "node:url";
import { dirname } from "pathe";
import type { RegionCode } from "../constants";
import { regions } from "../constants";

export * from "./array";
export * from "./auth";
export * from "./error/";
export * from "./failure-reason-group";
export * from "./format";
export * from "./object";
export * from "./package";
export * from "./pagination";
export * from "./types";

export const __filename = fileURLToPath(import.meta.url);
export const __dirname = dirname(__filename);

export function isRegion(value: RegionCode): value is RegionCode {
  return Object.values(regions).includes(value);
}
