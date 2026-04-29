import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

interface RegistryShape {
  next_story_id: number;
  next_asset_id: number;
  uuids: Record<string, string>;
  ids: Record<string, number>;
}

const DEFAULT_STATE: RegistryShape = {
  next_story_id: 100000,
  next_asset_id: 200000,
  uuids: {},
  ids: {},
};

export class Registry {
  private constructor(private readonly path: string, private state: RegistryShape) {}

  static load(path: string): Registry {
    if (existsSync(path)) {
      const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<RegistryShape>;
      return new Registry(path, { ...DEFAULT_STATE, ...raw });
    }
    return new Registry(path, structuredClone(DEFAULT_STATE));
  }

  save(): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, `${JSON.stringify(this.state, null, 2)}\n`);
  }

  mintStory(key: string): { id: number; uuid: string } {
    return this.mint(key, 'next_story_id');
  }

  mintAsset(key: string): { id: number; uuid: string } {
    return this.mint(key, 'next_asset_id');
  }

  getStory(key: string): { id: number; uuid: string } | undefined {
    return this.get(key);
  }

  getAsset(key: string): { id: number; uuid: string } | undefined {
    return this.get(key);
  }

  private mint(key: string, counter: 'next_story_id' | 'next_asset_id'): { id: number; uuid: string } {
    let uuid = this.state.uuids[key];
    let id = this.state.ids[key];
    if (!uuid) {
      uuid = randomUUID();
      this.state.uuids[key] = uuid;
    }
    if (id === undefined) {
      id = this.state[counter]++;
      this.state.ids[key] = id;
    }
    return { id, uuid };
  }

  private get(key: string): { id: number; uuid: string } | undefined {
    const uuid = this.state.uuids[key];
    const id = this.state.ids[key];
    if (uuid && id !== undefined) {
      return { id, uuid };
    }
    return undefined;
  }
}
