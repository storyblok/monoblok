import { session } from '../../../session';
import { konsola } from '../../../utils';
import { deleteDatasource, deleteDatasourceByName } from './actions';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../index';
import { datasourcesCommand } from '../command';
import chalk from 'chalk';
import { colorPalette } from '../../../constants';

vi.mock('./actions', () => ({
  deleteDatasource: vi.fn(),
  deleteDatasourceByName: vi.fn(),
}));

vi.mock('../../../creds', () => ({
  getCredentials: vi.fn(),
  addCredentials: vi.fn(),
  removeCredentials: vi.fn(),
  removeAllCredentials: vi.fn(),
}));

// Mocking the session module
vi.mock('../../../session', () => {
  let _cache: Record<string, any> | null = null;
  const session = () => {
    if (!_cache) {
      _cache = {
        state: {
          isLoggedIn: false,
        },
        updateSession: vi.fn(),
        persistCredentials: vi.fn(),
        initializeSession: vi.fn(),
      };
    }
    return _cache;
  };

  return {
    session,
  };
});

vi.mock('../../../utils/konsola');

describe('datasources delete command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    // Reset the option values
    datasourcesCommand._optionValues = {};
    for (const command of datasourcesCommand.commands) {
      command._optionValues = {};
    }
  });

  it('should delete a datasource by id', async () => {
    session().state = {
      isLoggedIn: true,
      password: 'valid-token',
      region: 'eu',
    };

    vi.mocked(deleteDatasource).mockResolvedValue(undefined);
    await datasourcesCommand.parseAsync(['node', 'test', 'delete', '--space', '12345', '--id', '45678']);
    expect(deleteDatasource).toHaveBeenCalledWith('12345', '45678');
    expect(konsola.ok).toHaveBeenCalledWith(`Datasource ${chalk.hex(colorPalette.DATASOURCES)('45678')} deleted successfully from space 12345.`);
  });

  it('should delete a datasource by name', async () => {
    session().state = {
      isLoggedIn: true,
      password: 'valid-token',
      region: 'eu',
    };

    vi.mocked(deleteDatasourceByName).mockResolvedValue(undefined);
    await datasourcesCommand.parseAsync(['node', 'test', 'delete', 'Countries', '--space', '12345']);
    expect(deleteDatasourceByName).toHaveBeenCalledWith('12345', 'Countries');
    expect(konsola.ok).toHaveBeenCalledWith(`Datasource ${chalk.hex(colorPalette.DATASOURCES)('Countries')} deleted successfully from space 12345.`);
  });

  it('should prompt the user with a warning if both name and id are provided', async () => {
    session().state = {
      isLoggedIn: true,
      password: 'valid-token',
      region: 'eu',
    };

    await datasourcesCommand.parseAsync(['node', 'test', 'delete', 'Countries', '--space', '12345', '--id', '45678']);
    expect(konsola.warn).toHaveBeenCalledWith('Both a datasource name and an id were provided. Only one is required. The id will be used as the source of truth.');
  });
});
