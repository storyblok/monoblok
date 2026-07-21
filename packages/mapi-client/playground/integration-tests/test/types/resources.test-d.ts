import { createManagementApiClient } from '@storyblok/management-api-client';
import { describe, expectTypeOf, it } from 'vitest';

const CLIENT_CONFIG = { personalAccessToken: 'test-token', spaceId: 12345 };

describe('datasources type tests', () => {
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

describe('datasource entries type tests', () => {
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

describe('asset folders type tests', () => {
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

describe('component folders type tests', () => {
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

describe('internal tags type tests', () => {
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

describe('presets type tests', () => {
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

describe('spaces type tests', () => {
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

describe('users type tests', () => {
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
