import {
  toLowerCaseKeys,
  deepSubset,
  deepEqual,
  countLeafNodes,
} from "./utils/helpers.ts";

const normalizeMethod = (m) => (m || "").toUpperCase();
const normalizePath = (p) => p || "/";

const matchHeaders = (reqHeaders, scenarioHeaders = {}, partial) => {
  const req = toLowerCaseKeys(reqHeaders || {});
  const sc = toLowerCaseKeys(scenarioHeaders || {});
  const keys = Object.keys(sc);
  if (keys.length === 0) return true;
  for (const k of keys) {
    const v = sc[k];
    if (!(k in req)) return false;
    if (partial) {
      if (req[k] !== v) return false;
    } else {
      if (req[k] !== v) return false; // same for now; extra keys allowed
    }
  }
  return true;
};

const matchQuery = (reqQuery, scenarioQuery = {}, partial) => {
  if (!scenarioQuery || Object.keys(scenarioQuery).length === 0) return true;
  for (const [k, v] of Object.entries(scenarioQuery)) {
    if (!(k in (reqQuery || {}))) return false;
    if (partial) {
      if (String(reqQuery[k]) !== String(v)) return false;
    } else {
      if (String(reqQuery[k]) !== String(v)) return false; // extras allowed
    }
  }
  return true;
};

const matchBody = (reqBody, scenarioBody, partial) => {
  if (scenarioBody === undefined) return true; // no constraint
  if (partial) return deepSubset(reqBody, scenarioBody);
  return deepEqual(reqBody, scenarioBody);
};

const scoreSpecificity = (scenario) => {
  const req = scenario.request || {};
  const headerScore = Object.keys(req.headers || {}).length;
  const queryScore = Object.keys(req.query || {}).length;
  const bodyScore = countLeafNodes(req.body || {});
  // Method+path weight to bias specificity equally
  return (
    (req.method ? 1 : 0) +
    (req.path ? 1 : 0) +
    headerScore +
    queryScore +
    bodyScore
  );
};

export const matchesScenario = (incoming, scenario) => {
  const sreq = scenario.request || {};
  const partial = !!sreq.partial;

  const methodMatch =
    !sreq.method ||
    normalizeMethod(incoming.method) === normalizeMethod(sreq.method);
  if (!methodMatch) return { matched: false, score: 0 };

  const pathMatch =
    !sreq.path || normalizePath(incoming.path) === normalizePath(sreq.path);
  if (!pathMatch) return { matched: false, score: 0 };

  const headersMatch = matchHeaders(
    incoming.headers || {},
    sreq.headers,
    partial
  );
  if (!headersMatch) return { matched: false, score: 0 };

  const queryMatch = matchQuery(incoming.query || {}, sreq.query, partial);
  if (!queryMatch) return { matched: false, score: 0 };

  const bodyMatch = matchBody(incoming.body, sreq.body, partial);
  if (!bodyMatch) return { matched: false, score: 0 };

  return { matched: true, score: scoreSpecificity(scenario) };
};
