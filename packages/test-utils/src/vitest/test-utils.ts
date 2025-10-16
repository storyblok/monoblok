import { it as baseIt } from "vitest";
import {
  makeStore,
  startServer,
  type Precondition,
} from "../utils/stub-server.ts";
import { parsePortRange, PORT_RANGE_STUB_SERVER } from "../utils/http.ts";

export { describe, expect, vi } from "vitest";

type TestContext = {
  stubServer: { baseURL: string };
  store: ReturnType<typeof makeStore>;
  prepare: (
    precondition: Precondition | Precondition[]
  ) => Promise<ReturnType<Precondition>[]>;
};

const toArray = (maybeArray: unknown) =>
  Array.isArray(maybeArray) ? maybeArray : [maybeArray];

export const it = baseIt.extend<TestContext>({
  stubServer: [
    async ({}, use) => {
      const portRange = parsePortRange(PORT_RANGE_STUB_SERVER);
      const port = portRange.start - 1 + Number(process.env.VITEST_WORKER_ID);
      if (port > portRange.end)
        throw new Error(
          `Tried to allocate port ${port}, but the maximum port is ${portRange.end}. Provide a larger range or reduce the number of workers.`
        );

      const { baseURL, stop } = await startServer({ port });

      try {
        await use({ baseURL });
      } finally {
        await stop();
      }
    },
    { scope: "worker" },
  ],
  store: [
    async ({ stubServer }, use) => {
      await use(makeStore({ baseURL: stubServer.baseURL }));
    },
    { scope: "worker" },
  ],
  prepare: async ({ store }, use) => {
    await use((precondition) =>
      Promise.all(toArray(precondition).map((p) => p({ store })))
    );
  },
});
