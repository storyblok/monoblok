import Ajv from "ajv";
import { sample as openapiSample } from "openapi-sampler";
import { deepMerge } from "./utils/helpers.ts";

const pickStatus = (operation) => {
  const all = operation?.responses ? Object.keys(operation.responses) : [];
  if (all.length === 0) return 200;
  if (all.includes("200")) return 200;
  const twoXX = all.find((c) => /^2\d\d$/.test(c));
  if (twoXX) return parseInt(twoXX, 10);
  if (all.includes("default")) return 200;
  return parseInt(all[0], 10) || 200;
};

const selectMediaType = (responsesObj, status, accept) => {
  const resObj = responsesObj[String(status)] || responsesObj.default;
  if (!resObj || !resObj.content) return { mediaType: null, mtObj: null };
  const available = Object.keys(resObj.content);
  if (available.length === 0) return { mediaType: null, mtObj: null };
  if (accept) {
    const preferred = available.find((mt) => accept.includes(mt));
    if (preferred)
      return { mediaType: preferred, mtObj: resObj.content[preferred] };
  }
  // Prefer application/json
  const json = available.find((mt) => mt.includes("json")) || available[0];
  return { mediaType: json, mtObj: resObj.content[json] };
};

const createAjv = () =>
  new Ajv({
    strict: false,
    allErrors: true,
  });

export class ResponseBuilder {
  constructor(openapiDoc) {
    this.openapiDoc = openapiDoc; // dereferenced
    this.ajv = createAjv();
    this.validatorCache = new Map(); // key: opId|status|mediaType
  }

  getResponseSchema(operation, status, mediaType) {
    const res =
      operation.responses?.[String(status)] || operation.responses?.default;
    if (!res) return null;
    if (!res.content) return null;
    const mt = res.content?.[mediaType] || Object.values(res.content)[0];
    if (!mt) return null;
    return mt.schema || null;
  }

  getValidator(operationId, operation, status, mediaType) {
    const key = `${operationId}|${status}|${mediaType}`;
    if (this.validatorCache.has(key)) return this.validatorCache.get(key);
    const schema = this.getResponseSchema(operation, status, mediaType);
    if (!schema) {
      const val = null;
      this.validatorCache.set(key, val);
      return val;
    }
    const validate = this.ajv.compile(schema);
    this.validatorCache.set(key, validate);
    return validate;
  }

  generateDefaultBody(operation, status, mediaType) {
    const schema = this.getResponseSchema(operation, status, mediaType);
    if (!schema) return undefined;
    try {
      // openapi-sampler works fine on dereferenced schemas
      return openapiSample(schema, {
        skipReadOnly: false,
        skipWriteOnly: false,
      });
    } catch {
      return undefined;
    }
  }

  buildFromScenario({ operationId, operation, accept, scenarioResponse }) {
    const status = scenarioResponse.status ?? pickStatus(operation);
    const { mediaType, mtObj } = selectMediaType(
      operation.responses || {},
      status,
      accept
    );
    const headers = { ...(scenarioResponse.headers || {}) };

    if (!mtObj || !mediaType) {
      // No body for this response (e.g., 204) or no content defined
      return { status, headers, body: undefined, mediaType: null };
    }

    const defaultBody = this.generateDefaultBody(operation, status, mediaType);

    if (scenarioResponse.partial === true) {
      const mergedBody = deepMerge(
        defaultBody ?? {},
        scenarioResponse.body ?? {}
      );
      return { status, headers, body: mergedBody, mediaType };
    }

    // Non-partial response
    if (scenarioResponse.body === undefined) {
      // No body provided → generate full
      return { status, headers, body: defaultBody, mediaType };
    }

    // Body provided → must fully satisfy schema
    const validate = this.getValidator(
      operationId,
      operation,
      status,
      mediaType
    );
    if (!validate) {
      // No schema to validate against; accept as-is
      return { status, headers, body: scenarioResponse.body, mediaType };
    }
    const ok = validate(scenarioResponse.body);
    if (!ok) {
      // Do not match this scenario (caller will treat as non-match)
      return {
        status,
        headers,
        body: null,
        mediaType,
        invalid: true,
        errors: validate.errors,
      };
    }
    return { status, headers, body: scenarioResponse.body, mediaType };
  }
}
