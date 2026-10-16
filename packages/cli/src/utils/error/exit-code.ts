export const EXIT_CODE_RUNTIME_ERROR = 1;
export const EXIT_CODE_USAGE_ERROR = 2;

let runtimeErrorExitCode = EXIT_CODE_RUNTIME_ERROR;

/**
 * Lets a run reserve `1` for its result, as `--exit-code` does for differences,
 * by moving runtime errors to `2`.
 */
export function setRuntimeErrorExitCode(code: number): void {
  runtimeErrorExitCode = code;
}

export function getRuntimeErrorExitCode(): number {
  return runtimeErrorExitCode;
}
