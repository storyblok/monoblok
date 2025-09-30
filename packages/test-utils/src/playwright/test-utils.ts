import { expect, test as base } from "@playwright/test";
import {
  parsePortRange,
  PORT_RANGE_APP,
  PORT_RANGE_STUB_SERVER,
  waitForHTTP,
} from "../utils/http.ts";
import {
  makeStore,
  startServer,
  type Precondition,
} from "../utils/stub-server.ts";
import { spawn } from "node:child_process";

interface UtilsTest {
  baseURL: string;
}

interface UtilsWorker {
  appPort: number;
  stubServer: { baseURL: string };
  store: ReturnType<typeof makeStore>;
  startApp: (command: string, preconditions?: Precondition[]) => Promise<void>;
  prepare: (
    precondition: Precondition | Precondition[]
  ) => Promise<ReturnType<Precondition>[]>;
}

const toArray = (maybeArray: unknown) =>
  Array.isArray(maybeArray) ? maybeArray : [maybeArray];

// TODO also logic for spinning up the app itself / the whole env
// maybe with switch for only stub to use dev server
export const it = base.extend<UtilsTest, UtilsWorker>({
  appPort: [
    async ({}, use, { workerIndex }) => {
      const portRange = parsePortRange(PORT_RANGE_APP);
      const port = portRange.start + workerIndex;
      if (port > portRange.end)
        throw new Error(
          `Tried to allocate port ${port}, but the maximum port is ${portRange.end}. Provide a larger range or reduce the number of workers.`
        );
      await use(port);
    },
    { scope: "worker" },
  ],
  stubServer: [
    async ({}, use, { workerIndex }) => {
      const portRange = parsePortRange(PORT_RANGE_STUB_SERVER);
      const port = portRange.start + workerIndex;
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
  startApp: [
    async ({ appPort, stubServer, store }, use) => {
      let stop: () => void = () => {};
      try {
        await use(async (command, preconditions = []) => {
          const [cmd, ...cmdOptions] = command.split(" ");
          if (!cmd) throw new Error("Invalid start command!");
          const app = spawn(cmd, cmdOptions, {
            env: {
              ...process.env,
              STORYBLOK_API_ENDPOINT: `${stubServer.baseURL}/v1`,
              PORT: String(appPort),
            },
          });
          app.stdout.on("data", (data) => {
            console.info(`App: ${data}`);
          });
          app.stderr.on("data", (data) => {
            console.error(`App: ${data}`);
          });
          stop = () => {
            app.kill();
          };

          await Promise.all([
            ...preconditions.map((p) => p({ store })),
            waitForHTTP(`http://localhost:${appPort}`),
          ]);
        });
      } finally {
        stop();
      }
    },
    { scope: "worker" },
  ],
  prepare: [
    async ({ store }, use) => {
      await use((precondition) =>
        Promise.all(toArray(precondition).map((p) => p({ store })))
      );
    },
    { scope: "worker" },
  ],
  baseURL: async ({ appPort }, use) => {
    await use(`http://localhost:${appPort}`);
  },
});

export { expect };
