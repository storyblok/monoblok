import { matchesScenario } from "./matchers.ts";

export class ScenarioStore {
  constructor() {
    this.scenarios = [];
    this.nextId = 1;
  }

  add(scenario) {
    const entry = {
      id: String(this.nextId++),
      ts: Date.now(),
      scenario,
    };
    this.scenarios.push(entry);
    return entry;
  }

  addMany(list) {
    return list.map((s) => this.add(s));
  }

  clear() {
    this.scenarios = [];
  }

  list() {
    return this.scenarios.map(({ id, ts, scenario }) => ({ id, ts, scenario }));
  }

  findBestMatch(incoming) {
    let best = null;
    for (const entry of this.scenarios) {
      const res = matchesScenario(incoming, entry.scenario);
      if (!res.matched) continue;
      if (!best) best = { entry, score: res.score };
      else if (
        res.score > best.score ||
        (res.score === best.score && entry.ts > best.entry.ts)
      ) {
        best = { entry, score: res.score };
      }
    }
    return best ? best.entry : null;
  }
}
