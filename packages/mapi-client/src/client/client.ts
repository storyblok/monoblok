import { getManagementBaseUrl, getRegion } from '@storyblok/region-helper';
import type { Client, Config, RequestOptions } from './types';
import {
  buildUrl,
  createConfig,
  createInterceptors,
  getParseAs,
  mergeConfigs,
  mergeHeaders,
  setAuthParams,
} from './utils';

type ReqInit = Omit<RequestInit, 'body' | 'headers'> & {
  body?: any;
  headers: ReturnType<typeof mergeHeaders>;
};

export const createClient = (config: Config): Client => {
  let _config = mergeConfigs(createConfig(), config);

  const getConfig = (): Config => ({ ..._config });

  const setConfig = (config: Config): Config => {
    _config = mergeConfigs(_config, config);
    return getConfig();
  };

  const interceptors = createInterceptors<
    Request,
    Response,
    unknown,
    RequestOptions
  >();

  const request: Client['request'] = async (options) => {
    const opts = {
      ..._config,
      ...options,
      fetch: options.fetch ?? _config.fetch ?? globalThis.fetch,
      headers: options.headers ? mergeHeaders(_config.headers, options.headers) : _config.headers,
    };

    // If the baseUrl is not set and we have a space_id, we can attempt to infer the region
    if (!_config.baseUrl && options.path?.space_id) {
      const region = getRegion(options.path.space_id as number, opts.region);
      if (region) {
        opts.baseUrl = getManagementBaseUrl(region, 'https');
      }
    } else if (!_config.baseUrl && opts.region) {
      opts.baseUrl = getManagementBaseUrl(opts.region, 'https');
    }

    if (opts.security) {
      await setAuthParams({
        ...opts,
        security: opts.security,
      });
    }

    if (opts.requestValidator) {
      await opts.requestValidator(opts);
    }

    if (opts.body && opts.bodySerializer) {
      opts.body = opts.bodySerializer(opts.body);
    }

    // remove Content-Type header if body is empty to avoid sending invalid requests
    if (opts.body === undefined || opts.body === '') {
      opts.headers.delete('Content-Type');
    }

    const url = buildUrl(opts);
    const requestInit: ReqInit = {
      redirect: 'follow',
      ...opts,
    };

    let request = new Request(url, requestInit);

    for (const fn of interceptors.request._fns) {
      if (fn) {
        request = await fn(request, opts);
      }
    }

    // fetch must be assigned here, otherwise it would throw the error:
    // TypeError: Failed to execute 'fetch' on 'Window': Illegal invocation
    const _fetch = opts.fetch!;
    
    // Execute with retry logic by recreating the request for each attempt
    let response = await executeWithRetry(_fetch, url, requestInit, {
      maxRetries: 3,
      retryDelay: 1000
    });

    for (const fn of interceptors.response._fns) {
      if (fn) {
        response = await fn(response, request, opts);
      }
    }

    const result = {
      request,
      response,
    };

    if (response.ok) {
      if (
        response.status === 204 ||
        response.headers.get('Content-Length') === '0'
      ) {
        return opts.responseStyle === 'data'
          ? {}
          : {
              data: {},
              ...result,
            };
      }

      const parseAs =
        (opts.parseAs === 'auto'
          ? getParseAs(response.headers.get('Content-Type'))
          : opts.parseAs) ?? 'json';

      let data: any;
      switch (parseAs) {
        case 'arrayBuffer':
        case 'blob':
        case 'formData':
        case 'json':
        case 'text':
          data = await response[parseAs]();
          break;
        case 'stream':
          return opts.responseStyle === 'data'
            ? response.body
            : {
                data: response.body,
                ...result,
              };
      }

      if (parseAs === 'json') {
        if (opts.responseValidator) {
          await opts.responseValidator(data);
        }

        if (opts.responseTransformer) {
          data = await opts.responseTransformer(data);
        }
      }

      return opts.responseStyle === 'data'
        ? data
        : {
            data,
            ...result,
          };
    }

    const textError = await response.text();
    let jsonError: unknown;

    try {
      jsonError = JSON.parse(textError);
    } catch {
      // noop
    }

    const error = jsonError ?? textError;
    let finalError = error;

    for (const fn of interceptors.error._fns) {
      if (fn) {
        finalError = (await fn(error, response, request, opts)) as string;
      }
    }

    finalError = finalError || ({} as string);

    if (opts.throwOnError) {
      throw finalError;
    }

    // TODO: we probably want to return error and improve types
    return opts.responseStyle === 'data'
      ? undefined
      : {
          error: finalError,
          ...result,
        };
  };

  // Helper function to execute fetch with retry logic
  async function executeWithRetry(
    fetchFn: any,
    url: string,
    requestInit: ReqInit,
    retryConfig: { maxRetries: number; retryDelay: number },
    attempt: number = 0
  ): Promise<Response> {
    try {
      const request = new Request(url, requestInit);
      const response = await fetchFn(request);
      
      if (response.status === 429 && attempt < retryConfig.maxRetries) {
        const retryAfter = response.headers.get('retry-after');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : retryConfig.retryDelay;
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Use the original unconsumed request for retry
        return executeWithRetry(fetchFn, url, requestInit, retryConfig, attempt + 1);
      }
      
      return response;
    } catch (error) {
      // If it's a network error and we haven't exceeded retries, try again
      if (attempt < retryConfig.maxRetries) {
        const delay = retryConfig.retryDelay;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Use the original unconsumed request for retry
        return executeWithRetry(fetchFn, url, requestInit, retryConfig, attempt + 1);
      }
      
      throw error;
    }
  }

  return {
    buildUrl,
    connect: (options) => request({ ...options, method: 'CONNECT' }),
    delete: (options) => request({ ...options, method: 'DELETE' }),
    get: (options) => request({ ...options, method: 'GET' }),
    getConfig,
    head: (options) => request({ ...options, method: 'HEAD' }),
    interceptors,
    options: (options) => request({ ...options, method: 'OPTIONS' }),
    patch: (options) => request({ ...options, method: 'PATCH' }),
    post: (options) => request({ ...options, method: 'POST' }),
    put: (options) => request({ ...options, method: 'PUT' }),
    request,
    setConfig,
    trace: (options) => request({ ...options, method: 'TRACE' }),
  };
};
