/**
 * Timing recorder for the find scenario harness. Runs inside the CLI process,
 * but is not part of the CLI: `probe.mjs` installs it through loader hooks,
 * so the measured code stays exactly what ships.
 *
 * Every record is one call of something worth timing, with the clock started
 * before the call and stopped when it settles. For an API call that covers the
 * wait for a rate-limit slot as well as the round trip, which is deliberate: the
 * client paces requests, so the queue wait is most of what an item costs.
 */
import { writeFileSync } from "node:fs";

const output = process.env.FIND_PROBE_OUT;
const records = [];

/** Distinguishes the very different things that reach one method. */
const tagFor = (group, method, args) => {
  if (group === "capi") {
    return args?.[0]?.query?.by_uuids ? "by_uuids" : "";
  }
  if (group === "stories" && method === "list" && args?.[0]?.query?.by_uuids) {
    return "by_uuids";
  }
  return "";
};

function timeCall(group, method, args, invoke) {
  const start = performance.now();
  const done = () =>
    records.push({
      group,
      method,
      tag: tagFor(group, method, args),
      start,
      end: performance.now(),
    });

  try {
    const result = invoke();
    if (result !== null && typeof result?.then === "function") {
      return result.then(
        (value) => {
          done();
          return value;
        },
        (error) => {
          done();
          throw error;
        },
      );
    }
    done();
    return result;
  } catch (error) {
    done();
    throw error;
  }
}

/**
 * Times every `client.<resource>.<method>()` through `time`. Resources are
 * proxied lazily rather than copied, so a client shape this harness has never
 * heard of still works.
 */
function timeResources(client, time) {
  return new Proxy(client, {
    get(target, resourceName) {
      const resource = target[resourceName];
      if (typeof resourceName !== "string" || resource === null || typeof resource !== "object") {
        return resource;
      }
      return new Proxy(resource, {
        get(methods, method) {
          const value = methods[method];
          if (typeof method !== "string" || typeof value !== "function") {
            return value;
          }
          return (...args) => time(resourceName, method, args, () => value.apply(methods, args));
        },
      });
    },
  });
}

/** Wraps `createManagementApiClient`, recording each call under its resource. */
export function wrapClientFactory(factory) {
  return (config) => timeResources(factory(config), timeCall);
}

/**
 * Wraps the CDN client's `createApiClient`. Records land under the `capi` group,
 * keyed by resource, which is what tells the CDN batches apart from the MAPI
 * requests in the same run.
 */
export function wrapCapiClientFactory(factory) {
  return (config) =>
    timeResources(factory(config), (resourceName, _method, args, invoke) =>
      timeCall("capi", resourceName, args, invoke),
    );
}

/**
 * Wraps `compile` so each compiled `--where` expression reports what evaluating
 * it against one story costs. Methods are invoked on the real query, never on
 * the proxy, so private class fields keep working.
 */
export function wrapCompile(compile) {
  return (expression) =>
    new Proxy(compile(expression), {
      get(query, property) {
        const value = Reflect.get(query, property, query);
        if (typeof value !== "function") {
          return value;
        }
        if (property === "match") {
          return (...args) => timeCall("jsonpath", "match", args, () => value.apply(query, args));
        }
        return value.bind(query);
      },
    });
}

process.on("exit", () => {
  if (!output) {
    return;
  }
  writeFileSync(output, records.map((record) => JSON.stringify(record)).join("\n"));
});
