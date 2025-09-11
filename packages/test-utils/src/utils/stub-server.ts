import { execSync } from "node:child_process";
import { waitForHTTP } from "./http.ts";
import path from "node:path";
import { readFileSync } from "node:fs";

type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export type HttpRequest = {
  method: HttpMethod;
  path: string;
  headers?: Record<string, string>;
  query?: Record<
    string,
    string | number | boolean | Array<string | number | boolean>
  >;
  body?: unknown;
};

export type HttpResponse = {
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
};

export type Example = {
  request?: HttpRequest;
  response?: HttpResponse;
  partial?: boolean;
};

export type ExampleStore = {
  add: (example: Example) => Promise<void>;
};

export type Precondition = ({
  store,
}: {
  store: ExampleStore;
}) => Promise<void>;

export const makeStore = ({ baseURL }: { baseURL: string }) => ({
  add: async ({ request, response, partial }: Example) => {
    const example = {
      "http-request": request,
      "http-response": response,
    };
    const result = await fetch(`${baseURL}/_specmatic/expectations`, {
      method: "POST",
      body: JSON.stringify(partial ? { partial: example } : example),
    });
    if (!result.ok)
      throw new Error(
        `Couldn't store example! Make sure your example matches the OpenAPI specification!\n\nSpecmatic: ${await result.text()}`
      );
  },
});

const specmaticConfigPath = path.resolve(process.cwd(), "specmatic.json");
const specmaticConfig = JSON.parse(
  readFileSync(specmaticConfigPath, {
    encoding: "utf8",
  })
) as {
  contracts: { consumes: string[] }[];
};

export const startServer = async ({ port }: { port: number }) => {
  const contractMaps = specmaticConfig.contracts.flatMap((x) =>
    x.consumes.map(
      (y) => [path.resolve(process.cwd(), y), y] satisfies [string, string]
    )
  );
  const mounts = contractMaps.map(
    ([from, to]) => `-v "${from}:${path.join("/usr/src/app", to)}"`
  );

  const id = execSync(
    `docker run --rm -d -p ${port}:9000 ${mounts.join(
      " "
    )} -v "${specmaticConfigPath}:/usr/src/app/specmatic.json" specmatic/specmatic:2.21.0 stub`
  )
    .toString()
    .trim();

  const baseURL = `http://localhost:${port}`;
  await waitForHTTP(`${baseURL}/actuator/health`);

  return {
    baseURL,
    stop: async () => {
      if (id) await execSync(`docker stop ${id}`);
    },
  };
};
