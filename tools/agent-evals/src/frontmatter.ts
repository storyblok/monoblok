const ROUTING_KEYS = new Set(["model", "effort"]);

export function stripRoutingFrontmatter(markdown: string): string {
  const lines = markdown.split("\n");
  if (lines[0] !== "---") return markdown;
  const end = lines.indexOf("---", 1);
  if (end === -1) return markdown;
  const kept = lines.slice(1, end).filter((line) => {
    const key = /^([a-z-]+):/.exec(line)?.[1];
    return key === undefined || !ROUTING_KEYS.has(key);
  });
  return ["---", ...kept, ...lines.slice(end)].join("\n");
}
