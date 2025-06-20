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
  push_component_preset: 'Failed to push component preset',
  push_component_internal_tag: 'Failed to push component internal tag',
  update_component: 'Failed to update component',
  update_component_internal_tag: 'Failed to update component internal tag',
  update_component_group: 'Failed to update component group',
  update_component_preset: 'Failed to update component preset',
  pull_stories: 'Failed to pull stories',
  pull_story: 'Failed to pull story',
  update_story: 'Failed to update story',
} as const;

export const API_ERRORS = {
  unauthorized: 'The user is not authorized to access the API',
  network_error: 'No response from server, please check if you are correctly connected to internet',
  invalid_credentials: 'The provided credentials are invalid',
  timeout: 'The API request timed out',
  generic: 'Error fetching data from the API',
  not_found: 'The requested resource was not found',
  unprocessable_entity: 'The request was well-formed but was unable to be followed due to semantic errors',

} as const;

export function handleAPIError(action: keyof typeof API_ACTIONS, error: unknown, customMessage?: string): void {
  if (error instanceof FetchError) {
    const status = error.response.status;

    switch (status) {
      case 401:
        throw new APIError('unauthorized', action, error, customMessage);
      case 404:
        throw new APIError('not_found', action, error, customMessage);
      case 422:
        throw new APIError('unprocessable_entity', action, error, customMessage);
      default:
        throw new APIError('network_error', action, error, customMessage);
    }
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

    if (this.code === 422) {
      const responseData = this.response?.data as { [key: string]: string[] } | undefined;
      if (responseData?.name?.[0] === 'has already been taken') {
        this.message = 'A component with this name already exists';
      }
      Object.entries(responseData || {}).forEach(([key, errors]) => {
        if (Array.isArray(errors)) {
          errors.forEach((e) => {
            this.messageStack.push(`${key}: ${e}`);
          });
        }
      });
    }
  }

  getInfo() {
    return {
      name: this.name,
      message: this.message,
      httpCode: this.code,
      cause: this.cause,
      errorId: this.errorId,
      stack: this.stack,
      responseData: this.response?.data,
    };
  }
}
