#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "fs";
import { join, relative } from "path";
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
 * Usage: node tools/docs-check.mjs [file ...] (defaults to every package)
 */

// H2s every reference.md has, in this order, before the API sections.
// Optional ones may be left out.
const LEADING = [
  { title: "Requirements", optional: true },
  { title: "Installation" },
  { title: "Usage" },
  { title: "TypeScript", optional: true },
];
const TRAILING = "Further resources";
const ALERTS = new Set(["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"]);

export function checkFile(path, raw) {
  const text = raw.replace(/\r\n?/g, "\n");
  const errors = [];
  const error = (line, message) => errors.push({ line, message });
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
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      headings.push({ depth: heading[1].length, line: n, text: heading[2].trim() });
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

  // Template order for reference.md.
  if (isReference) {
    const h2s = headings.filter((h) => h.depth === 2);
    let next = 0;
    for (const [i, h] of h2s.entries()) {
      const known = LEADING.findIndex((s) => s.title === h.text);
      if (known >= 0) {
        if (known < next) {
          error(
            h.line,
            `Move "${h.text}" up. The order is ${LEADING.map((s) => s.title).join(", ")}.`,
          );
        }
        next = known + 1;
      } else if (h.text === TRAILING) {
        if (i !== h2s.length - 1) {
          error(h.line, `Make "${TRAILING}" the last section.`);
        }
      } else if (next < LEADING.length) {
        const missing = LEADING.slice(next).filter(
          (s) => !s.optional && !h2s.some((x) => x.text === s.title),
        );
        if (missing.length) {
          error(
            h.line,
            `Add ${missing.map((s) => `"${s.title}"`).join(" and ")} before "${h.text}".`,
          );
        }
        next = LEADING.length;
      }
    }
    for (const s of LEADING) {
      if (!s.optional && !h2s.some((h) => h.text === s.title)) {
        error(bodyStart + 1, `Add a "${s.title}" section.`);
      }
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
  for (const file of files) {
    const errors = checkFile(file, readFileSync(file, "utf-8"));
    for (const e of errors) {
      const path = relative(process.cwd(), file);
      console.log(
        process.env.GITHUB_ACTIONS
          ? `::error file=${path},line=${e.line}::${e.message}`
          : `${path}:${e.line}  ${e.message}`,
      );
    }
    if (errors.length) {
      failed++;
    }
  }
  console.log(`${files.length} file(s) checked, ${failed} with errors.`);
  process.exit(failed ? 1 : 0);
}
