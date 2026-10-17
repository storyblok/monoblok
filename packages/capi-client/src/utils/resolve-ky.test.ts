import { expect, it } from "vitest";
import { resolveKy } from "./resolve-ky";

it("should return a callable default export unchanged (ESM build)", () => {
  const ky = () => "ok";
  expect(resolveKy<typeof ky>(ky)).toBe(ky);
});

it("should unwrap the module namespace that require() returns for ky (CJS build)", () => {
  const ky = () => "ok";
  const namespace = { default: ky, HTTPError: class {} };
  expect(resolveKy<typeof ky>(namespace)).toBe(ky);
});

it("should leave anything else untouched", () => {
  expect(resolveKy(undefined)).toBeUndefined();
  const notKy = { default: "nope" };
  expect(resolveKy(notKy)).toBe(notKy);
});
