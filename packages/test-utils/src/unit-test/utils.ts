import { it as baseIt } from "vitest";
import {
  makeStore,
  startServer,
  type Precondition,
} from "../utils/stub-server.ts";

export { describe, expect } from "vitest";

type TestContext = {
  stubServer: { baseURL: string };
  store: ReturnType<typeof makeStore>;
  prepare: (precondition: Precondition) => ReturnType<typeof precondition>;
};

export const it = baseIt.extend<TestContext>({
  stubServer: [
    async ({}, use) => {
      const port = 8999 + Number(process.env.VITEST_WORKER_ID);
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
    await use((precondition) => precondition({ store }));
  },
});
