import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Setup MSW server with request handlers
export const server = setupServer(...handlers);

// Export utilities for easy test usage
export { handlers } from './handlers';
export { http, HttpResponse } from 'msw';
