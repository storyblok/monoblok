const MAX_SUGGESTIONS = 3;
/** Share of the longer name that may differ, so `hero` doesn't suggest `card`. */
const MAX_DIFFERENCE = 0.4;

/** The number of single-character edits that turn `a` into `b`. */
function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      current.push(Math.min(previous[j] + 1, current[j - 1] + 1, substitution));
    }
    previous = current;
  }
  return previous[b.length];
}

/** The names closest to `name`, closest first, ignoring case. */
export function similarNames(name: string, candidates: Iterable<string>): string[] {
  const target = name.toLowerCase();
  return [...new Set(candidates)]
    .filter((candidate) => candidate !== name)
    .map((candidate) => ({
      candidate,
      distance: editDistance(target, candidate.toLowerCase()),
      length: Math.max(target.length, candidate.length),
    }))
    .filter(({ distance, length }) => distance <= length * MAX_DIFFERENCE)
    .sort((a, b) => a.distance - b.distance || a.candidate.localeCompare(b.candidate))
    .slice(0, MAX_SUGGESTIONS)
    .map(({ candidate }) => candidate);
}

/** ` Did you mean "a" or "b"?`, or nothing when no name is close. */
export function didYouMean(name: string, candidates: Iterable<string>): string {
  const names = similarNames(name, candidates).map((candidate) => `"${candidate}"`);
  if (names.length === 0) return "";
  const last = names.pop();
  const list = names.length === 0 ? last : `${names.join(", ")} or ${last}`;
  return ` Did you mean ${list}?`;
}
