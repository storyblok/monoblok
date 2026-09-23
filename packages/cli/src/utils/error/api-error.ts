import { getCredentialContext } from "./credential-context";
import { matchCredentialError } from "./credential-hint";
import { FetchError } from "../fetch";

export const API_ACTIONS = {
  login: "login",
  login_with_token: "Failed to log in with token",
  login_with_otp: "Failed to log in with email, password and otp",
  login_email_password: "Failed to log in with email and password",
  get_user: "Failed to get user",
  pull_languages: "Failed to pull languages",
  pull_components: "Failed to pull components",
  pull_component_groups: "Failed to pull component groups",
  pull_component_presets: "Failed to pull component presets",
  pull_component_internal_tags: "Failed to pull component internal tags",
  push_component: "Failed to push component",
  push_component_group: "Failed to push component group",
  push_component_folder: "Failed to create component folder",
  delete_component_folder: "Failed to delete component folder",
  push_component_preset: "Failed to push component preset",
  push_component_internal_tag: "Failed to push component internal tag",
  update_component: "Failed to update component",
  update_component_internal_tag: "Failed to update component internal tag",
  update_component_group: "Failed to update component group",
  update_component_preset: "Failed to update component preset",
  delete_component_preset: "Failed to delete component preset",
  delete_component: "Failed to delete component",
  pull_stories: "Failed to pull stories",
  pull_story: "Failed to pull story",
  create_story: "Failed to create story",
  update_story: "Failed to update story",
  pull_asset: "Failed to pull asset",
  pull_assets: "Failed to pull assets",
  transfer_enumerate_assets: "Failed to enumerate assets for transfer",
  pull_asset_folder: "Failed to pull asset folder",
  pull_asset_folders: "Failed to pull asset folders",
  push_asset_folder: "Failed to push asset folder",
  push_asset_create: "Failed to create asset",
  push_asset_update: "Failed to update asset",
  pull_asset_internal_tags: "Failed to pull asset internal tags",
  push_asset_internal_tag: "Failed to push asset internal tag",
  transfer_asset: "Failed to transfer asset",
  pull_shared_assets: "Failed to pull library assets",
  pull_shared_asset: "Failed to pull library asset",
  // Folder discovery runs on both the pull and the push path, so this stays verb-neutral:
  // a push must not report a failure to "pull" anything.
  list_shared_asset_folders: "Failed to list library folders",
  pull_shared_asset_folder: "Failed to pull library folder",
  pull_shared_internal_tags: "Failed to pull library tags",
  push_shared_asset_create: "Failed to create library asset",
  push_shared_asset_update: "Failed to update library asset",
  push_shared_asset_folder: "Failed to push library folder",
  push_shared_internal_tag: "Failed to push library tag",
  pull_datasources: "Failed to pull datasources",
  push_datasource: "Failed to push datasource",
  update_datasource: "Failed to update datasource",
  delete_datasource: "Failed to delete datasource",
  push_datasource_entry: "Failed to push datasource entry",
  update_datasource_entry: "Failed to update datasource entry",
  delete_datasource_entry: "Failed to delete datasource entry",
  create_space: "Failed to create space",
  pull_spaces: "Failed to pull spaces",
  fetch_blueprints: "Failed to fetch blueprints from GitHub",
} as const;

export const API_ERRORS = {
  unauthorized: "The user is not authorized to access the API",
  network_error: "No response from server, please check if you are correctly connected to internet",
  server_error: "The server returned an error",
  invalid_credentials: "The provided credentials are invalid",
  timeout: "The API request timed out",
  generic: "Error fetching data from the API",
  not_found: "The requested resource was not found",
  unprocessable_entity:
    "The request was well-formed but was unable to be followed due to semantic errors",
  forbidden: "The user is not allowed to perform this action",
  insufficient_scope: "The credential is missing a required permission",
} as const;

function getErrorId(status: number): keyof typeof API_ERRORS {
  switch (status) {
    case 401:
      return "unauthorized";
    case 404:
      return "not_found";
    case 422:
      return "unprocessable_entity";
    case 403:
      return "forbidden";
    default:
      return status >= 500 ? "server_error" : "generic";
  }
}

/**
 * HTTP reason phrases for status codes where MAPI echoes them back verbatim.
 * HTTP/2 sends empty statusText, so we can't rely on the response header alone.
 */
const HTTP_REASON_PHRASES: Partial<Record<number, string>> = {
  401: "Unauthorized",
  403: "Forbidden",
};

/** Returns the first data.error / data.message string, unless it just echoes the HTTP reason phrase. */
function extractServerString(
  data: Record<string, unknown>,
  status: number,
  statusText: string | undefined,
): string | undefined {
  const boringPhrase = statusText || HTTP_REASON_PHRASES[status] || "";
  for (const field of [data.error, data.message]) {
    if (typeof field === "string" && field && field !== boringPhrase) {
      return field;
    }
  }
  return undefined;
}

function pushFieldErrors(stack: string[], fields: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      for (const e of value) {
        stack.push(`${key}: ${e}`);
      }
    }
  }
}

/**
 * Key prefixes to strip when promoting a field error to this.message.
 * "base" is the Rails convention for model-level errors not tied to a field.
 * Add entries here to suppress other internal keys without changing any logic.
 */
const STRIP_FIELD_PREFIXES = ["base: "] as const;

function stripBasePrefix(entry: string): string {
  for (const prefix of STRIP_FIELD_PREFIXES) {
    if (entry.startsWith(prefix)) {
      return entry.slice(prefix.length);
    }
  }
  return entry;
}

function replaceOrAppend(stack: string[], target: string, replacement: string): void {
  const lastIdx = stack.length - 1;
  if (lastIdx >= 0 && stack[lastIdx] === target) {
    stack[lastIdx] = replacement;
  } else {
    stack.push(replacement);
  }
}

export function handleAPIError(
  action: keyof typeof API_ACTIONS,
  error: unknown,
  customMessage?: string,
): never {
  if (error instanceof FetchError) {
    const errorId = getErrorId(error.response.status);
    throw new APIError(errorId, action, error, customMessage);
  }

  // Handle non-FetchError objects with a response property (e.g. mapi-client ClientError).
  // Forward request context best-effort so --verbose can show it.
  const response = (error as any)?.response;
  if (response?.status) {
    const reqCandidate = (error as any)?.request;
    const wrappedError = new FetchError(
      response.statusText ?? (error as Error).message,
      { status: response.status, statusText: response.statusText ?? "", data: response.data },
      {
        url: typeof reqCandidate?.url === "string" ? reqCandidate.url : undefined,
        method: typeof reqCandidate?.method === "string" ? reqCandidate.method : undefined,
      },
    );
    const errorId = getErrorId(response.status);
    throw new APIError(errorId, action, wrappedError, customMessage);
  }

  throw new APIError("generic", action, error as FetchError, customMessage);
}

export class APIError extends Error {
  errorId: string;
  cause: string;
  code: number;
  messageStack: string[];
  error: FetchError | undefined;
  response: FetchError["response"] | undefined;
  /** True when the failure is credential-level, so bulk loops should stop instead of retrying. */
  fatal: boolean;
  /**
   * The raw `data.error`/`data.message` string extracted from the response, before any
   * rewrite. Undefined when a `customMessage` suppressed extraction, or none was present.
   * Callers that need to distinguish specific server signatures (e.g. the unsupported-token-type
   * 403) beyond the generic `errorId`/`fatal` classification should match on this.
   */
  serverError: string | undefined;
  constructor(
    errorId: keyof typeof API_ERRORS,
    action: keyof typeof API_ACTIONS,
    error?: FetchError,
    customMessage?: string,
  ) {
    super(customMessage || API_ERRORS[errorId]);
    this.name = "API Error";
    this.errorId = errorId;
    this.cause = API_ERRORS[errorId];
    this.code = error?.response?.status || 0;
    this.messageStack = [];
    this.error = error;
    this.response = error?.response;
    this.fatal = false;
    this.serverError = undefined;

    if (!customMessage) {
      this.messageStack.push(API_ACTIONS[action]);
    }
    this.messageStack.push(customMessage || API_ERRORS[errorId]);

    const responseData = this.response?.data as Record<string, unknown> | undefined;
    const statusText = this.response?.statusText;

    const serverMessage = customMessage
      ? undefined
      : extractServerString(responseData ?? {}, this.code, statusText);
    this.serverError = serverMessage;

    const stackLengthBefore422 = this.messageStack.length;

    if (this.code === 422) {
      // Scope the name-taken rewrite to the action that raised it.
      const nameField = responseData?.name;
      if (Array.isArray(nameField) && nameField[0] === "has already been taken") {
        if (action === "push_component_folder") {
          this.message = "A component folder with this name already exists";
        } else if (action === "push_component" || action === "update_component") {
          this.message = "A component with this name already exists";
        }
      }

      pushFieldErrors(this.messageStack, responseData ?? {});

      // One level of nesting: {"error":{"base":["msg"]}} / {"errors":{…}}
      for (const key of ["error", "errors"] as const) {
        const nested = responseData?.[key];
        if (nested !== null && typeof nested === "object" && !Array.isArray(nested)) {
          pushFieldErrors(this.messageStack, nested as Record<string, unknown>);
        }
      }
    }

    // Promote the most specific available message; skip when customMessage or
    // the 422 name-taken rewrite already set a specific one.
    if (!customMessage && this.message === API_ERRORS[errorId]) {
      if (serverMessage) {
        this.message = serverMessage;
        this.cause = serverMessage;
        replaceOrAppend(this.messageStack, API_ERRORS[errorId], serverMessage);
      } else if (this.messageStack.length > stackLengthBefore422) {
        this.message = stripBasePrefix(this.messageStack[stackLengthBefore422]);
        this.cause = this.message;
      }
    }

    // A credential-level 401/403 gets a rewritten, actionable message. This runs last so it
    // wins over the raw server string, and replaces only the final stack entry so the
    // `API_ACTIONS[action]` context line above it survives.
    const hint = customMessage
      ? undefined
      : matchCredentialError(this.code, serverMessage, getCredentialContext());
    if (hint) {
      this.errorId = hint.errorId;
      this.message = hint.message;
      this.cause = hint.message;
      this.fatal = hint.fatal;
      this.messageStack[this.messageStack.length - 1] = hint.message;
    }
  }

  getInfo() {
    const request = this.error?.request;
    const hasRequestContext = Boolean(request && (request.url || request.method));
    return {
      name: this.name,
      message: this.message,
      httpCode: this.code,
      cause: this.cause,
      errorId: this.errorId,
      stack: this.stack,
      responseData: this.response?.data,
      ...(hasRequestContext ? { request: { url: request!.url, method: request!.method } } : {}),
    };
  }
}
