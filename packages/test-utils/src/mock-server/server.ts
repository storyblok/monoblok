import Fastify from "fastify";
import fs from "node:fs";
import { execSync } from "node:child_process";
import YAML from "js-yaml";
import { glob } from "glob";
import $RefParser from "@apidevtools/json-schema-ref-parser";
import { OpenAPIBackend } from "openapi-backend";
import { ScenarioStore } from "./scenario-store.ts";
import { ResponseBuilder } from "./response-builder.ts";
import { toLowerCaseKeys } from "./utils/helpers.ts";
import path from "node:path";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4010;

interface OpenApiPackage {
  path: string;
}

const getOpenAPISpecs = async () => {
  const openapiListOutput = execSync(
    "pnpm --filter @storyblok/openapi list --json",
    { encoding: "utf8" }
  );
  const openapiPackages: OpenApiPackage[] = JSON.parse(openapiListOutput);
  const yamlFiles: string[] = [];
  for (const openapiPackage of openapiPackages) {
    const specDirPath = openapiPackage.path;
    const specPaths = (
      await glob("dist/mapi/*.yaml", { cwd: specDirPath })
    ).map((f) => path.join(specDirPath, f));
    yamlFiles.push(...specPaths);
  }

  return yamlFiles;
};

const readAndBundleSpec = async (specPath) => {
  const raw = fs.readFileSync(specPath, "utf8");
  const doc = YAML.load(raw);
  const bundled = await $RefParser.bundle(doc);
  return bundled;
};

const makeMockHandler =
  ({ openapiDoc, scenarioStore }) =>
  (c) => {
    const responseBuilder = new ResponseBuilder(openapiDoc);
    const incoming = {
      method: c.request.method,
      path: c.request.path,
      headers: toLowerCaseKeys(c.request.headers || {}),
      query: c.request.query || {},
      body: c.request.requestBody ?? c.request.body,
    };

    const matched = scenarioStore.findBestMatch(incoming);
    if (matched) {
      const resOut = responseBuilder.buildFromScenario({
        operationId: c.operation.operationId,
        operation: c.operation,
        accept: c.request.headers?.accept || c.request.headers?.Accept,
        scenarioResponse: matched.scenario.response || {},
      });
      if (!resOut.invalid) {
        const headers = resOut.mediaType
          ? { "content-type": resOut.mediaType, ...(resOut.headers || {}) }
          : resOut.headers || {};
        return { statusCode: resOut.status, headers, body: resOut.body };
      }
    }

    if (!c.operation.operationId)
      throw new Error("OpenAPI `operationId` is required for mocking!");

    const { status, mock } = c.api.mockResponseForOperation(
      c.operation.operationId
    );
    return { statusCode: status, body: mock };
  };

const createApiForDoc = (openapiDoc, scenarioStore) => {
  const api = new OpenAPIBackend({ definition: openapiDoc, validate: false });

  const operations = {};
  for (const [pathString, apiPath] of Object.entries(openapiDoc.paths)) {
    for (const [httpVerb, apiMethod] of Object.entries(apiPath)) {
      if (!apiMethod.operationId) {
        console.warn(
          `No \`operationId\` for ${httpVerb.toUpperCase()}: ${pathString}`
        );
        continue;
      }
      operations[apiMethod.operationId] = makeMockHandler({
        openapiDoc,
        scenarioStore,
      });
      console.info(
        `Register handler \`${
          apiMethod.operationId
        }\` for ${httpVerb.toUpperCase()}: ${pathString}`
      );
    }
  }

  api.register({
    notFound: () => ({ statusCode: 404, body: { error: "route not found" } }),
    validationFail: (c) => ({
      statusCode: 422,
      body: { error: "validation failed", details: c.validation.errors },
    }),
    // Operation matched & validated → apply scenarios, else mock from spec
    // notImplemented: makeMockHandler({ openapiDoc, scenarioStore }),
    // ...()
    ...operations,
  });

  api.init();
  return api;
};

const start = async () => {
  const app = Fastify({ logger: true });
  const specs = await getOpenAPISpecs();

  // Load all specs
  const docs = [];
  for (const p of specs) {
    app.log.info(`Loading OpenAPI: ${p}`);
    docs.push(await readAndBundleSpec(p));
  }

  // Shared scenario store across all APIs
  const scenarioStore = new ScenarioStore();

  // One OpenAPIBackend per doc
  const apis = docs.map((doc) => createApiForDoc(doc, scenarioStore));

  // Health
  app.get("/__health", async () => ({ status: "ok" }));

  // Config endpoints (shared)
  app.post("/__config", async (request, reply) => {
    const payload = request.body;
    if (!payload)
      return reply.code(400).send({ error: "missing scenario(s) in body" });
    const scenarios = Array.isArray(payload) ? payload : [payload];

    const accepted = [];
    for (const sc of scenarios) {
      if (!sc || typeof sc !== "object" || !sc.request || !sc.response)
        continue;
      if (sc.request.method)
        sc.request.method = String(sc.request.method).toUpperCase();
      if (sc.request.headers) {
        sc.request.headers = Object.fromEntries(
          Object.entries(sc.request.headers).map(([k, v]) => [
            k.toLowerCase(),
            v,
          ])
        );
      }
      if (sc.response && sc.response.headers) {
        sc.response.headers = Object.fromEntries(
          Object.entries(sc.response.headers).map(([k, v]) => [
            k.toLowerCase(),
            v,
          ])
        );
      }
      accepted.push(sc);
    }
    if (accepted.length === 0)
      return reply.code(400).send({ error: "no valid scenarios provided" });

    const added = scenarioStore.addMany(accepted);
    return reply.code(201).send({ added: added.map(({ id }) => id) });
  });

  app.get("/__config", async () => scenarioStore.list());
  app.delete("/__config", async (request, reply) => {
    scenarioStore.clear();
    return reply.code(204).send();
  });

  // Catch-all: try each API in order
  app.all("/*", async (request, reply) => {
    const url = new URL(request.raw.url, "http://localhost");
    const reqForOAB = {
      method: request.method,
      path: url.pathname,
      query: request.query,
      headers: request.headers,
      body: request.body,
    };

    for (const api of apis) {
      const result = await api.handleRequest(reqForOAB);
      if (!result || result.statusCode === 404) continue;

      if (result.headers) reply.headers(result.headers);
      reply.code(result.statusCode || 200).send(result.body);
      return;
    }

    // None matched
    reply.code(404).send({ error: "route not found" });
  });

  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
    app.log.info(`Mock server running on http://localhost:${PORT}`);
    app.log.info(`Loaded specs: ${specs.join(", ")}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
