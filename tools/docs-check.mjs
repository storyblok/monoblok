#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "fs";
import { dirname, join, relative, resolve } from "path";
import { fileURLToPath } from "url";

/**
 * Checks package docs against the library reference template, so a page
 * that passes here renders on the docs platform without edits.
 *
 * Each package can have:
 * - `docs/reference.md`: the package's page on storyblok.com/docs
 * - `docs/migrations/*.md`: one page per migration guide
 *
 * Both ship in the npm package (add `docs` to `files`) and are synced to the
 * docs platform when the package is published. See `docs/docs-platform.md`.
 *
 * Errors are things that break the page on the docs platform or on GitHub
 * and npm. Warnings are about the template's shape: worth fixing, but they
 * don't fail CI.
 *
 * The template itself is in `docs/library-reference-template.md`.
 *
 * Usage: node tools/docs-check.mjs [file ...] (defaults to every package)
 */

// Sections reference.md usually opens with, in this order. Anything after
// them is free: API, topic sections, TypeScript.
const LEADING = ["Requirements", "Installation", "Usage"];
const TRAILING = "Further resources";
const ALERTS = new Set(["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"]);
// A version line under a heading, rendered as a badge on the docs platform.
const BADGE = /^_(Introduced in|Updated in|Deprecated since)\b(.*)_\s*$/;

/**
 * @param {string} path
 * @param {string} raw
 * @param {{ version?: string }} [pkg] The package.json version, for the badge check.
 * @returns {{ level: "error" | "warning", line: number, message: string }[]}
 */
export function checkFile(path, raw, pkg = {}) {
  const text = raw.replace(/\r\n?/g, "\n");
  const errors = [];
  const error = (line, message) => errors.push({ level: "error", line, message });
  const warn = (line, message) => errors.push({ level: "warning", line, message });
  const major = pkg.version && Number(pkg.version.split(".")[0]);
  const lines = text.split("\n");
  const isReference = path.endsWith("reference.md");

  // Frontmatter: title and description only.
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(text);
  const meta = {};
  if (!fm) {
    error(1, "Start the file with frontmatter that has a title and a description.");
  } else {
    let key;
    for (const [i, line] of fm[1].split("\n").entries()) {
      const m = /^(\w+):\s*(.*)$/.exec(line);
      if (!m) {
        // A value wrapped onto indented lines.
        if (key && /^\s+\S/.test(line)) {
          meta[key] = `${meta[key]} ${line.trim()}`.trim();
        }
        continue;
      }
      key = m[1];
      if (key !== "title" && key !== "description") {
        error(i + 2, `Remove "${key}" from the frontmatter. Only title and description are used.`);
      }
      meta[key] = m[2];
    }
    for (const k of Object.keys(meta)) {
      meta[k] = meta[k].replace(/^"(.*)"$|^'(.*)'$/, "$1$2");
    }
    for (const field of ["title", "description"]) {
      if (!meta[field]) {
        error(1, `Add a ${field} to the frontmatter.`);
      }
    }
  }
  const bodyStart = fm ? fm[0].split("\n").length - 1 : 0;

  // Walk the body outside code fences.
  const headings = [];
  let fence = null;
  let previous = "";
  let comment = false;
  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i];
    const n = i + 1;
    const open = /^(\s*)(```+|~~~+)(.*)$/.exec(line);
    if (open && !fence) {
      fence = open[2];
      if (!open[3].trim()) {
        error(n, "Add a language to the code block, for example ```js.");
      }
      continue;
    }
    if (fence) {
      // A closing fence uses the same character, is at least as long, and has
      // nothing after it.
      const close = /^\s*(```+|~~~+)\s*$/.exec(line);
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) {
        fence = null;
      }
      continue;
    }
    // HTML comments are notes for authors, dropped on the docs platform.
    if (comment || /^\s*<!--/.test(line)) {
      comment = !line.includes("-->");
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      headings.push({ depth: heading[1].length, line: n, text: heading[2].trim() });
    }

    const badge = BADGE.exec(line.trim());
    if (badge) {
      const version = badge[2].trim();
      if (!/^\d+\.\d+\.\d+$/.test(version)) {
        error(n, `Write the version as X.Y.Z, for example "_${badge[1]} 8.1.0_".`);
      } else if (major && Number(version.split(".")[0]) !== major) {
        warn(
          n,
          `Remove "${badge[1]} ${version}". Badges only mark changes within the current major (${major}.x).`,
        );
      }
      if (!/^#{2,6}\s/.test(previous)) {
        warn(n, `Put "_${badge[1]} ${version}_" right under the heading it belongs to.`);
      }
    }
    if (line.trim()) {
      previous = line;
    }

    const prose = line.replace(/`[^`]*`/g, "");
    if (/<[A-Za-z][\w.]*[\s/>]/.test(prose) || /\{\/\*/.test(prose)) {
      error(
        n,
        "Use Markdown only. HTML and MDX components don't render the same on GitHub, npm, and the docs platform.",
      );
    }
    const alert = /^>\s*\[!(\w+)\]/.exec(line);
    if (alert && !ALERTS.has(alert[1])) {
      error(n, `Use one of ${[...ALERTS].join(", ")} for alerts.`);
    }
    if (alert && line.trim() !== `> [!${alert[1]}]`) {
      error(n, `Put "> [!${alert[1]}]" on a line of its own, or it renders as a plain quote.`);
    }
    for (const m of prose.matchAll(/\]\(([^)\s]+)/g)) {
      const href = m[1];
      if (href.startsWith("/")) {
        error(
          n,
          `Use an absolute URL for "${href}", for example https://www.storyblok.com${href}. Site-relative links break on GitHub and npm.`,
        );
      } else if (!/^(https?:|mailto:|#)/.test(href)) {
        error(
          n,
          `Link "${href}" points to a file in the repository, which doesn't exist on the docs platform. Use an absolute URL.`,
        );
      }
    }
  }

  // One H1, matching the title, before anything else.
  const h1s = headings.filter((h) => h.depth === 1);
  if (h1s.length !== 1) {
    error(h1s[1]?.line ?? bodyStart + 1, "Use exactly one H1, the page title.");
  } else if (meta.title && h1s[0].text !== meta.title) {
    error(h1s[0].line, `Make the H1 match the title "${meta.title}".`);
  }

  // No skipped levels.
  for (let i = 1; i < headings.length; i++) {
    if (headings[i].depth > headings[i - 1].depth + 1) {
      error(
        headings[i].line,
        `Don't skip heading levels (H${headings[i - 1].depth} → H${headings[i].depth}).`,
      );
    }
  }

  // Template shape for reference.md. Only "Further resources" is an error,
  // because the docs platform turns that section into cards and can't if
  // anything follows it.
  if (isReference) {
    const h2s = headings.filter((h) => h.depth === 2);
    const position = (title) => h2s.findIndex((h) => h.text === title);
    if (position("Installation") < 0) {
      warn(bodyStart + 1, 'Add an "Installation" section.');
    }
    const present = LEADING.filter((title) => position(title) >= 0);
    for (let i = 1; i < present.length; i++) {
      if (position(present[i]) < position(present[i - 1])) {
        const h = h2s[position(present[i - 1])];
        warn(
          h.line,
          `Move "${present[i - 1]}" above "${present[i]}". The order is ${LEADING.join(", ")}.`,
        );
      }
    }
    const trailing = position(TRAILING);
    if (trailing >= 0 && trailing !== h2s.length - 1) {
      error(h2s[trailing].line, `Make "${TRAILING}" the last section.`);
    }
    const previousVersions = h2s.find((h) => h.text === "Previous versions");
    if (previousVersions) {
      warn(
        previousVersions.line,
        'Remove "Previous versions". The docs platform adds a version switcher to every library page.',
      );
    }
  }

  // In-page anchors must resolve (GitHub and the docs platform slug headings the same way).
  const slugs = new Map();
  const anchors = new Set();
  for (const h of headings) {
    const base = h.text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .replace(/\s/g, "-");
    const count = slugs.get(base) ?? 0;
    slugs.set(base, count + 1);
    anchors.add(count ? `${base}-${count}` : base);
  }
  for (const [i, line] of lines.entries()) {
    for (const m of line.replace(/`[^`]*`/g, "").matchAll(/\]\(#([^)\s]+)\)/g)) {
      if (!anchors.has(m[1])) {
        error(i + 1, `No heading for the anchor "#${m[1]}".`);
      }
    }
  }

  return errors.toSorted((a, b) => a.line - b.line);
}

// The version in the package.json of the package that owns a docs file.
function packageVersion(file) {
  let dir = dirname(resolve(file));
  while (dir !== dirname(dir)) {
    const manifest = join(dir, "package.json");
    if (existsSync(manifest)) {
      return JSON.parse(readFileSync(manifest, "utf-8")).version;
    }
    dir = dirname(dir);
  }
  return undefined;
}

function packageDocs(packagesDir = "packages") {
  const files = [];
  for (const entry of readdirSync(packagesDir).toSorted()) {
    const docs = join(packagesDir, entry, "docs");
    if (existsSync(join(docs, "reference.md"))) {
      files.push(join(docs, "reference.md"));
    }
    const migrations = join(docs, "migrations");
    if (existsSync(migrations)) {
      files.push(
        ...readdirSync(migrations)
          .filter((f) => f.endsWith(".md"))
          .toSorted()
          .map((f) => join(migrations, f)),
      );
    }
  }
  return files;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const files = process.argv.length > 2 ? process.argv.slice(2) : packageDocs();
  let failed = 0;
  let warnings = 0;
  for (const file of files) {
    const results = checkFile(file, readFileSync(file, "utf-8"), { version: packageVersion(file) });
    const path = relative(process.cwd(), file);
    for (const r of results) {
      console.log(
        process.env.GITHUB_ACTIONS
          ? `::${r.level} file=${path},line=${r.line}::${r.message}`
          : `${path}:${r.line}  ${r.level}  ${r.message}`,
      );
    }
    if (results.some((r) => r.level === "error")) {
      failed++;
    }
    warnings += results.filter((r) => r.level === "warning").length;
  }
  console.log(`${files.length} file(s) checked, ${failed} with errors, ${warnings} warning(s).`);
  process.exit(failed ? 1 : 0);
}
