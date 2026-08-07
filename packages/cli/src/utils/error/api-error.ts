import { FetchError } from '../fetch';

export const API_ACTIONS = {
  login: 'login',
  login_with_token: 'Failed to log in with token',
  login_with_otp: 'Failed to log in with email, password and otp',
  login_email_password: 'Failed to log in with email and password',
  get_user: 'Failed to get user',
  pull_languages: 'Failed to pull languages',
  pull_components: 'Failed to pull components',
  pull_component_groups: 'Failed to pull component groups',
  pull_component_presets: 'Failed to pull component presets',
  pull_component_internal_tags: 'Failed to pull component internal tags',
  push_component: 'Failed to push component',
  push_component_group: 'Failed to push component group',
  push_component_folder: 'Failed to create component folder',
  delete_component_folder: 'Failed to delete component folder',
  push_component_preset: 'Failed to push component preset',
  push_component_internal_tag: 'Failed to push component internal tag',
  update_component: 'Failed to update component',
  update_component_internal_tag: 'Failed to update component internal tag',
  update_component_group: 'Failed to update component group',
  update_component_preset: 'Failed to update component preset',
  delete_component_preset: 'Failed to delete component preset',
  delete_component: 'Failed to delete component',
  pull_stories: 'Failed to pull stories',
  pull_story: 'Failed to pull story',
  create_story: 'Failed to create story',
  update_story: 'Failed to update story',
  pull_asset: 'Failed to pull asset',
  pull_assets: 'Failed to pull assets',
  transfer_enumerate_assets: 'Failed to enumerate assets for transfer',
  pull_asset_folder: 'Failed to pull asset folder',
  pull_asset_folders: 'Failed to pull asset folders',
  push_asset_folder: 'Failed to push asset folder',
  push_asset_create: 'Failed to create asset',
  push_asset_update: 'Failed to update asset',
  pull_asset_internal_tags: 'Failed to pull asset internal tags',
  push_asset_internal_tag: 'Failed to push asset internal tag',
  transfer_asset: 'Failed to transfer asset',
  pull_shared_assets: 'Failed to pull library assets',
  pull_shared_asset: 'Failed to pull library asset',
  pull_shared_asset_folders: 'Failed to pull library folders',
  pull_shared_asset_folder: 'Failed to pull library folder',
  pull_shared_internal_tags: 'Failed to pull library tags',
  push_shared_asset_create: 'Failed to create library asset',
  push_shared_asset_update: 'Failed to update library asset',
  push_shared_asset_folder: 'Failed to push library folder',
  push_shared_internal_tag: 'Failed to push library tag',
  pull_datasources: 'Failed to pull datasources',
  push_datasource: 'Failed to push datasource',
  update_datasource: 'Failed to update datasource',
  delete_datasource: 'Failed to delete datasource',
  push_datasource_entry: 'Failed to push datasource entry',
  update_datasource_entry: 'Failed to update datasource entry',
  delete_datasource_entry: 'Failed to delete datasource entry',
  create_space: 'Failed to create space',
  pull_spaces: 'Failed to pull spaces',
  fetch_blueprints: 'Failed to fetch blueprints from GitHub',
} as const;

export const API_ERRORS = {
  unauthorized: 'The user is not authorized to access the API',
  network_error: 'No response from server, please check if you are correctly connected to internet',
  server_error: 'The server returned an error',
  invalid_credentials: 'The provided credentials are invalid',
  timeout: 'The API request timed out',
  generic: 'Error fetching data from the API',
  not_found: 'The requested resource was not found',
  unprocessable_entity: 'The request was well-formed but was unable to be followed due to semantic errors',
} as const;

function getErrorId(status: number): keyof typeof API_ERRORS {
  switch (status) {
    case 401:
      return 'unauthorized';
    case 404:
      return 'not_found';
    case 422:
      return 'unprocessable_entity';
    default:
      return status >= 500 ? 'server_error' : 'generic';
  }
}

/**
 * Canonical HTTP reason phrases for status codes where MAPI echoes them back
 * as an uninformative `{"error":"..."}` body. HTTP/2 sends an empty statusText,
 * so we can't rely on the response header alone — fall back to the phrase here.
 */
const HTTP_REASON_PHRASES: Partial<Record<number, string>> = {
  401: 'Unauthorized',
  403: 'Forbidden',
};

/**
 * Returns the first non-empty string field from `data` that is not identical
 * to the HTTP statusText or the canonical HTTP reason phrase for the status code.
 * Skipping those prevents echoed reason phrases (e.g. {"error":"Unauthorized"} on 401)
 * from replacing the more informative API_ERRORS constants. HTTP/2 sends an empty
 * statusText, so the canonical phrase is used as a fallback comparison value.
 * Checks `error` before `message` to match MAPI's field priority.
 */
function extractServerString(data: Record<string, unknown>, status: number, statusText: string | undefined): string | undefined {
  const boringPhrase = statusText || HTTP_REASON_PHRASES[status] || '';
  for (const field of [data.error, data.message]) {
    if (typeof field === 'string' && field && field !== boringPhrase) {
      return field;
    }
  }
  return undefined;
}

/**
 * Pushes `key: value` entries from `fields` into `stack` for every key whose
 * value is a string array. Used for both top-level and nested MAPI 422 shapes.
 */
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
 * Field-error key prefixes that carry no user-facing meaning and should be
 * stripped when promoting the first 422 field error to `this.message`.
 * Add entries here to suppress additional internal keys without touching logic.
 *
 * "base" is the Rails convention for model-level errors not tied to any field.
 */
const STRIP_FIELD_PREFIXES = ['base: '] as const;

/**
 * Strips internal field-error key prefixes from a formatted "key: value" entry.
 * All other field names (e.g. "name:", "slug:") are preserved — they tell the
 * user which field is invalid.
 */
function stripBasePrefix(entry: string): string {
  for (const prefix of STRIP_FIELD_PREFIXES) {
    if (entry.startsWith(prefix)) {
      return entry.slice(prefix.length);
    }
  }
  return entry;
}

/**
 * Replaces the last entry in `stack` when it equals `target`; otherwise appends.
 * Used to swap the generic API_ERRORS placeholder with a server-provided message.
 */
function replaceOrAppend(stack: string[], target: string, replacement: string): void {
  const lastIdx = stack.length - 1;
  if (lastIdx >= 0 && stack[lastIdx] === target) {
    stack[lastIdx] = replacement;
  }
  else {
    stack.push(replacement);
  }
}

export function handleAPIError(action: keyof typeof API_ACTIONS, error: unknown, customMessage?: string): never {
  if (error instanceof FetchError) {
    const errorId = getErrorId(error.response.status);
    throw new APIError(errorId, action, error, customMessage);
  }

  // Handle non-FetchError objects that have a response property (e.g. mapi-client ClientError).
  // ClientError itself doesn't carry request context, but some wrappers attach
  // a `request` field — forward it best-effort so verbose output can show it.
  const response = (error as any)?.response;
  if (response?.status) {
    const reqCandidate = (error as any)?.request;
    const wrappedError = new FetchError(
      response.statusText ?? (error as Error).message,
      { status: response.status, statusText: response.statusText ?? '', data: response.data },
      {
        url: typeof reqCandidate?.url === 'string' ? reqCandidate.url : undefined,
        method: typeof reqCandidate?.method === 'string' ? reqCandidate.method : undefined,
      },
    );
    const errorId = getErrorId(response.status);
    throw new APIError(errorId, action, wrappedError, customMessage);
  }

  throw new APIError('generic', action, error as FetchError, customMessage);
}

export class APIError extends Error {
  errorId: string;
  cause: string;
  code: number;
  messageStack: string[];
  error: FetchError | undefined;
  response: FetchError['response'] | undefined;
  constructor(errorId: keyof typeof API_ERRORS, action: keyof typeof API_ACTIONS, error?: FetchError, customMessage?: string) {
    super(customMessage || API_ERRORS[errorId]);
    this.name = 'API Error';
    this.errorId = errorId;
    this.cause = API_ERRORS[errorId];
    this.code = error?.response?.status || 0;
    this.messageStack = [];
    this.error = error;
    this.response = error?.response;

    if (!customMessage) {
      this.messageStack.push(API_ACTIONS[action]);
    }
    this.messageStack.push(customMessage || API_ERRORS[errorId]);

    const responseData = this.response?.data as Record<string, unknown> | undefined;
    const statusText = this.response?.statusText;

    // Extract a server-provided human-readable message early so it is available
    // both during the 422 block and for the final message override below.
    // Guards: skip when customMessage was provided; skip when the server string
    // merely echoes the HTTP reason phrase (e.g. {"error":"Unauthorized"} on 401 —
    // HTTP/2 sends empty statusText, so we also compare against the canonical phrase).
    const serverMessage = customMessage ? undefined : extractServerString(responseData ?? {}, this.code, statusText);

    const stackLengthBefore422 = this.messageStack.length;

    if (this.code === 422) {
      // Scope the "name already taken" rewrite to the action that raised it so a
      // folder create failure does not claim "component" (and vice versa).
      const nameField = responseData?.name;
      if (Array.isArray(nameField) && nameField[0] === 'has already been taken') {
        if (action === 'push_component_folder') {
          this.message = 'A component folder with this name already exists';
        }
        else if (action === 'push_component' || action === 'update_component') {
          this.message = 'A component with this name already exists';
        }
      }

      // Push top-level field arrays: {"slug":["taken"]}
      pushFieldErrors(this.messageStack, responseData ?? {});

      // Push one level of nesting: {"error":{"base":["msg"]}} / {"errors":{…}}
      for (const key of ['error', 'errors'] as const) {
        const nested = responseData?.[key];
        if (nested !== null && typeof nested === 'object' && !Array.isArray(nested)) {
          pushFieldErrors(this.messageStack, nested as Record<string, unknown>);
        }
      }
    }

    // Replace the generic API_ERRORS placeholder with the most specific message available.
    // Priority: (1) top-level server string (e.g. {"error":"Your space must be verified…"}),
    // (2) first raw field value from the 422 response (e.g. "This asset folder is not valid").
    // The messageStack keeps full key:value entries for verbose display; this.message gets
    // the raw value so internal field names (Rails "base", param names, etc.) don't leak through.
    // Skipped when a customMessage was provided or when the 422 name-taken rewrite already
    // produced a specific message.
    if (!customMessage && this.message === API_ERRORS[errorId]) {
      if (serverMessage) {
        this.message = serverMessage;
        this.cause = serverMessage;
        replaceOrAppend(this.messageStack, API_ERRORS[errorId], serverMessage);
      }
      else if (this.messageStack.length > stackLengthBefore422) {
        // 422 with field errors — use the first pushed entry as a summary.
        // Field names are preserved (e.g. "name: can't be blank") so the user
        // knows which field is invalid. Only "base:" is stripped because it is a
        // Rails model-level key with no user-facing meaning.
        this.message = stripBasePrefix(this.messageStack[stackLengthBefore422]);
        this.cause = this.message;
      }
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
