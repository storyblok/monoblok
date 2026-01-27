import { konsola } from '../../../utils';
import { deleteDatasource } from './actions';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../index';
import { datasourcesCommand } from '../command';
import chalk from 'chalk';
import { colorPalette } from '../../../constants';
import { fetchDatasource } from '../pull/actions';
import { confirm } from '@inquirer/prompts';

vi.mock('./actions', () => ({
  deleteDatasource: vi.fn(),
}));

vi.mock('../pull/actions', () => ({
  fetchDatasource: vi.fn(),
}));

vi.mock('../../../creds', () => ({
  getCredentials: vi.fn(),
  addCredentials: vi.fn(),
  removeCredentials: vi.fn(),
  removeAllCredentials: vi.fn(),
}));

vi.mock('@inquirer/prompts', () => ({
  confirm: vi.fn(),
}));

vi.mock('../../../utils/konsola');

describe('datasources delete command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    // Reset the option values
    (datasourcesCommand as any)._optionValues = {};
    for (const command of datasourcesCommand.commands) {
      (command as any)._optionValues = {};
    }
  });

  it('should delete a datasource by id', async () => {
    vi.mocked(deleteDatasource).mockResolvedValue(undefined);
    await datasourcesCommand.parseAsync(['node', 'test', 'delete', '--space', '12345', '--id', '45678']);
    expect(deleteDatasource).toHaveBeenCalledWith('12345', '45678');
    expect(konsola.ok).toHaveBeenCalledWith(`Datasource ${chalk.hex(colorPalette.DATASOURCES)('45678')} deleted successfully from space 12345.`);
  });

  it('should delete a datasource by name', async () => {
    vi.mocked(fetchDatasource).mockResolvedValue({
      id: 45678,
      name: 'Countries',
      slug: 'countries',
      created_at: '2021-01-01',
      updated_at: '2021-01-01',
      dimensions: [],
    });
    vi.mocked(confirm).mockResolvedValue(true);
    vi.mocked(deleteDatasource).mockResolvedValue(undefined);
    await datasourcesCommand.parseAsync(['node', 'test', 'delete', 'Countries', '--space', '12345']);
    expect(deleteDatasource).toHaveBeenCalledWith('12345', '45678');
    expect(konsola.ok).toHaveBeenCalledWith(`Datasource ${chalk.hex(colorPalette.DATASOURCES)('Countries')} deleted successfully from space 12345.`);
  });

  it('should prompt the user with a warning if both name and id are provided', async () => {
    await datasourcesCommand.parseAsync(['node', 'test', 'delete', 'Countries', '--space', '12345', '--id', '45678']);
    expect(konsola.warn).toHaveBeenCalledWith('Both a datasource name and an id were provided. Only one is required. The id will be used as the source of truth.');
  });
});
