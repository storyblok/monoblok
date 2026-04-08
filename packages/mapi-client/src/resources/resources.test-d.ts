import { describe, expectTypeOf, it } from 'vitest';
import {
  defineAssetFolderCreate,
  defineAssetFolderUpdate,
  defineBlockFolderCreate,
  defineBlockFolderUpdate,
  defineDatasourceCreate,
  defineDatasourceEntryCreate,
  defineDatasourceEntryUpdate,
  defineDatasourceUpdate,
  defineInternalTagCreate,
  defineInternalTagUpdate,
  definePresetCreate,
  definePresetUpdate,
  defineSpaceCreate,
  defineSpaceUpdate,
  defineUserUpdate,
} from '@storyblok/schema/mapi';
import { createManagementApiClient } from '../index';

const CLIENT_CONFIG = { personalAccessToken: 'test-token', spaceId: 12345 };

// ─── Datasources ────────────────────────────────────────────────────────────

describe('datasources type tests', () => {
  it('should produce a defineDatasourceCreate result assignable to datasources.create body', () => {
    const payload = defineDatasourceCreate({ name: 'Categories', slug: 'categories' });

    type CreateBody = Parameters<ReturnType<typeof createManagementApiClient>['datasources']['create']>[0]['body'];
    type InnerType = NonNullable<CreateBody['datasource']>;

    expectTypeOf(payload).toExtend<InnerType>();
  });

  it('should produce a defineDatasourceUpdate result assignable to datasources.update body', () => {
    const payload = defineDatasourceUpdate({ name: 'Updated Categories' });

    type UpdateBody = Parameters<ReturnType<typeof createManagementApiClient>['datasources']['update']>[1]['body'];
    type InnerType = NonNullable<UpdateBody['datasource']>;

    expectTypeOf(payload).toExtend<InnerType>();
  });

  it('should return datasource in response from create', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG);
    const result = await client.datasources.create({
      body: { datasource: { name: 'Test', slug: 'test' } },
    });
    if (result.data) {
      expectTypeOf(result.data).toHaveProperty('datasource');
    }
  });

  it('should return datasource in response from get', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG);
    const result = await client.datasources.get(1);
    if (result.data) {
      expectTypeOf(result.data).toHaveProperty('datasource');
    }
  });

  it('should return datasources array in response from list', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG);
    const result = await client.datasources.list();
    if (result.data) {
      expectTypeOf(result.data).toHaveProperty('datasources');
    }
  });
});

// ─── Datasource Entries ─────────────────────────────────────────────────────

describe('datasource entries type tests', () => {
  it('should produce a defineDatasourceEntryCreate result assignable to datasourceEntries.create body', () => {
    const payload = defineDatasourceEntryCreate({ name: 'red', value: '#ff0000', datasource_id: 42 });

    type CreateBody = Parameters<ReturnType<typeof createManagementApiClient>['datasourceEntries']['create']>[0]['body'];
    type InnerType = NonNullable<CreateBody['datasource_entry']>;

    expectTypeOf(payload).toExtend<InnerType>();
  });

  it('should produce a defineDatasourceEntryUpdate result assignable to datasourceEntries.update body', () => {
    const payload = defineDatasourceEntryUpdate({ value: '#00ff00' });

    type UpdateBody = Parameters<ReturnType<typeof createManagementApiClient>['datasourceEntries']['update']>[1]['body'];
    type InnerType = NonNullable<UpdateBody['datasource_entry']>;

    expectTypeOf(payload).toExtend<InnerType>();
  });

  it('should return datasource_entry in response from create', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG);
    const result = await client.datasourceEntries.create({
      body: { datasource_entry: { name: 'red', value: '#ff0000', datasource_id: 42 } },
    });
    if (result.data) {
      expectTypeOf(result.data).toHaveProperty('datasource_entry');
    }
  });

  it('should return datasource_entry in response from get', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG);
    const result = await client.datasourceEntries.get(1);
    if (result.data) {
      expectTypeOf(result.data).toHaveProperty('datasource_entry');
    }
  });

  it('should return datasource_entries array in response from list', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG);
    const result = await client.datasourceEntries.list();
    if (result.data) {
      expectTypeOf(result.data).toHaveProperty('datasource_entries');
    }
  });
});

// ─── Asset Folders ──────────────────────────────────────────────────────────

describe('asset folders type tests', () => {
  it('should produce a defineAssetFolderCreate result assignable to assetFolders.create body', () => {
    const payload = defineAssetFolderCreate({ name: 'Images' });

    type CreateBody = Parameters<ReturnType<typeof createManagementApiClient>['assetFolders']['create']>[0]['body'];
    type InnerType = NonNullable<CreateBody['asset_folder']>;

    expectTypeOf(payload).toExtend<InnerType>();
  });

  it('should produce a defineAssetFolderUpdate result assignable to assetFolders.update body', () => {
    const payload = defineAssetFolderUpdate({ name: 'Updated Images' });

    type UpdateBody = Parameters<ReturnType<typeof createManagementApiClient>['assetFolders']['update']>[1]['body'];
    type InnerType = NonNullable<UpdateBody['asset_folder']>;

    expectTypeOf(payload).toExtend<InnerType>();
  });

  it('should return asset_folder in response from create', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG);
    const result = await client.assetFolders.create({
      body: { asset_folder: { name: 'Photos' } },
    });
    if (result.data) {
      expectTypeOf(result.data).toHaveProperty('asset_folder');
    }
  });

  it('should return asset_folder in response from get', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG);
    const result = await client.assetFolders.get(1);
    if (result.data) {
      expectTypeOf(result.data).toHaveProperty('asset_folder');
    }
  });

  it('should return asset_folders array in response from list', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG);
    const result = await client.assetFolders.list();
    if (result.data) {
      expectTypeOf(result.data).toHaveProperty('asset_folders');
    }
  });
});

// ─── Component Folders ──────────────────────────────────────────────────────

describe('component folders type tests', () => {
  it('should produce a defineBlockFolderCreate result assignable to componentFolders.create body', () => {
    const payload = defineBlockFolderCreate({ name: 'Layout' });

    type CreateBody = Parameters<ReturnType<typeof createManagementApiClient>['componentFolders']['create']>[0]['body'];
    type InnerType = NonNullable<CreateBody['component_group']>;

    expectTypeOf(payload).toExtend<InnerType>();
  });

  it('should produce a defineBlockFolderUpdate result assignable to componentFolders.update body', () => {
    const payload = defineBlockFolderUpdate({ name: 'Updated Layout' });

    type UpdateBody = Parameters<ReturnType<typeof createManagementApiClient>['componentFolders']['update']>[1]['body'];
    type InnerType = NonNullable<UpdateBody['component_group']>;

    expectTypeOf(payload).toExtend<InnerType>();
  });

  it('should return component_group in response from create', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG);
    const result = await client.componentFolders.create({
      body: { component_group: { name: 'Layout' } },
    });
    if (result.data) {
      expectTypeOf(result.data).toHaveProperty('component_group');
    }
  });

  it('should return component_group in response from get', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG);
    const result = await client.componentFolders.get(1);
    if (result.data) {
      expectTypeOf(result.data).toHaveProperty('component_group');
    }
  });

  it('should return component_groups array in response from list', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG);
    const result = await client.componentFolders.list();
    if (result.data) {
      expectTypeOf(result.data).toHaveProperty('component_groups');
    }
  });
});

// ─── Internal Tags ──────────────────────────────────────────────────────────

describe('internal tags type tests', () => {
  it('should produce a defineInternalTagCreate result assignable to internalTags.create body', () => {
    const payload = defineInternalTagCreate({ name: 'hero', object_type: 'asset' });

    type CreateBody = Parameters<ReturnType<typeof createManagementApiClient>['internalTags']['create']>[0]['body'];
    type InnerType = NonNullable<CreateBody['internal_tag']>;

    expectTypeOf(payload).toExtend<InnerType>();
  });

  it('should produce a defineInternalTagUpdate result assignable to internalTags.update body', () => {
    const payload = defineInternalTagUpdate({ name: 'hero-image' });

    type UpdateBody = Parameters<ReturnType<typeof createManagementApiClient>['internalTags']['update']>[1]['body'];
    type InnerType = NonNullable<UpdateBody['internal_tag']>;

    expectTypeOf(payload).toExtend<InnerType>();
  });

  it('should return internal_tag in response from create', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG);
    const result = await client.internalTags.create({
      body: { internal_tag: { name: 'hero' } },
    });
    if (result.data) {
      expectTypeOf(result.data).toHaveProperty('internal_tag');
    }
  });

  it('should return internal_tags array in response from list', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG);
    const result = await client.internalTags.list();
    if (result.data) {
      expectTypeOf(result.data).toHaveProperty('internal_tags');
    }
  });
});

// ─── Presets ────────────────────────────────────────────────────────────────

describe('presets type tests', () => {
  it('should produce a definePresetCreate result assignable to presets.create body', () => {
    const payload = definePresetCreate({ name: 'Hero Dark', component_id: 42 });

    type CreateBody = Parameters<ReturnType<typeof createManagementApiClient>['presets']['create']>[0]['body'];
    type InnerType = NonNullable<CreateBody['preset']>;

    expectTypeOf(payload).toExtend<InnerType>();
  });

  it('should produce a definePresetUpdate result assignable to presets.update body', () => {
    const payload = definePresetUpdate({ name: 'Hero Light' });

    type UpdateBody = Parameters<ReturnType<typeof createManagementApiClient>['presets']['update']>[1]['body'];
    type InnerType = NonNullable<UpdateBody['preset']>;

    expectTypeOf(payload).toExtend<InnerType>();
  });

  it('should return preset in response from create', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG);
    const result = await client.presets.create({
      body: { preset: { name: 'Hero Dark', component_id: 42 } },
    });
    if (result.data) {
      expectTypeOf(result.data).toHaveProperty('preset');
    }
  });

  it('should return preset in response from get', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG);
    const result = await client.presets.get(1);
    if (result.data) {
      expectTypeOf(result.data).toHaveProperty('preset');
    }
  });

  it('should return presets array in response from list', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG);
    const result = await client.presets.list();
    if (result.data) {
      expectTypeOf(result.data).toHaveProperty('presets');
    }
  });
});

// ─── Spaces ─────────────────────────────────────────────────────────────────

describe('spaces type tests', () => {
  it('should produce a defineSpaceCreate result assignable to spaces.create body', () => {
    const payload = defineSpaceCreate({ name: 'My New Space' });

    type CreateBody = Parameters<ReturnType<typeof createManagementApiClient>['spaces']['create']>[0]['body'];
    type InnerType = CreateBody['space'];

    expectTypeOf(payload).toExtend<InnerType>();
  });

  it('should produce a defineSpaceUpdate result assignable to spaces.update body', () => {
    const payload = defineSpaceUpdate({ name: 'Updated Space Name' });

    type UpdateBody = Parameters<ReturnType<typeof createManagementApiClient>['spaces']['update']>[0]['body'];
    type InnerType = UpdateBody['space'];

    expectTypeOf(payload).toExtend<InnerType>();
  });

  it('should return space in response from create', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG);
    const result = await client.spaces.create({
      body: { space: { name: 'Test Space' } },
    });
    if (result.data) {
      expectTypeOf(result.data).toHaveProperty('space');
    }
  });

  it('should return space in response from get', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG);
    const result = await client.spaces.get();
    if (result.data) {
      expectTypeOf(result.data).toHaveProperty('space');
    }
  });

  it('should return spaces array in response from list', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG);
    const result = await client.spaces.list();
    if (result.data) {
      expectTypeOf(result.data).toHaveProperty('spaces');
    }
  });
});

// ─── Users ──────────────────────────────────────────────────────────────────

describe('users type tests', () => {
  it('should produce a defineUserUpdate result assignable to users.updateMe body', () => {
    const payload = defineUserUpdate({ firstname: 'Jane', lastname: 'Doe' });

    type UpdateBody = Parameters<ReturnType<typeof createManagementApiClient>['users']['updateMe']>[0]['body'];
    type InnerType = UpdateBody['user'];

    expectTypeOf(payload).toExtend<InnerType>();
  });

  it('should return user in response from updateMe', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG);
    const result = await client.users.updateMe({
      body: { user: { firstname: 'Jane' } },
    });
    if (result.data) {
      expectTypeOf(result.data).toHaveProperty('user');
    }
  });

  it('should return user in response from me', async () => {
    const client = createManagementApiClient(CLIENT_CONFIG);
    const result = await client.users.me();
    if (result.data) {
      expectTypeOf(result.data).toHaveProperty('user');
    }
  });
});
