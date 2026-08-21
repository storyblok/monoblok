/**
 * Minimal static file server for the playgrounds that build to a directory.
 *
 * Deliberately dependency-free: pulling `serve` in at run time would put a
 * registry fetch between the build and the smoke test, and a flaky one of
 * those would read as a packaging failure.
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.argv[2] ?? "dist");
const port = Number(process.env.MATRIX_PORT ?? 3000);

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const candidate = path.join(root, path.normalize(decoded));

  if (!candidate.startsWith(root)) return undefined;

  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;

  for (const suffix of ["index.html", ".html"]) {
    const withSuffix =
      suffix === "index.html" ? path.join(candidate, suffix) : `${candidate}${suffix}`;
    if (existsSync(withSuffix) && statSync(withSuffix).isFile()) return withSuffix;
  }

  const fallback = path.join(root, "index.html");
  return existsSync(fallback) ? fallback : undefined;
}

createServer((request, response) => {
  const file = resolveFile(request.url ?? "/");

  if (!file) {
    response.writeHead(404, { "content-type": "text/plain" });
    response.end("not found");
    return;
  }

  response.writeHead(200, {
    "content-type": CONTENT_TYPES[path.extname(file)] ?? "application/octet-stream",
    "cache-control": "no-store",
  });
  createReadStream(file).pipe(response);
}).listen(port, "0.0.0.0", () => {
  process.stdout.write(`serving ${root} on ${port}\n`);
});
