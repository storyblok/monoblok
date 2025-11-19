import { expect, it, vi } from 'vitest';
import { ConsoleTransport } from './logger-transport-console';
import { APIError } from './error';
import { FetchError } from './fetch';

vi.spyOn(console, 'error');
vi.spyOn(console, 'warn');
vi.spyOn(console, 'info');
vi.spyOn(console, 'debug');

it('should only log level equal or more severe to the specified level', () => {
  // Error
  const transportLevelError = new ConsoleTransport({ level: 'error' });
  transportLevelError.log({ level: 'error', message: 'Error!' });
  expect(console.error).toHaveBeenCalledWith(
    expect.stringMatching(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\]\s{2}ERROR\s{2}Error!$/),
  );
  transportLevelError.log({ level: 'warn', message: 'Warn!' });
  expect(console.warn).not.toHaveBeenCalledWith(
    expect.stringMatching(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\]\s{2}WARN\s{3}Warn!$/),
  );
  transportLevelError.log({ level: 'info', message: 'Info' });
  expect(console.info).not.toHaveBeenCalledWith(
    expect.stringMatching(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\]\s{2}INFO\s{3}Info$/),
  );
  transportLevelError.log({ level: 'debug', message: 'Debug' });
  expect(console.debug).not.toHaveBeenCalledWith(
    expect.stringMatching(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\]\s{2}DEBUG\s{2}Debug$/),
  );

  // Info
  const transportLevelInfo = new ConsoleTransport({ level: 'info' });
  transportLevelInfo.log({ level: 'error', message: 'Error!' });
  expect(console.error).toHaveBeenCalledWith(
    expect.stringMatching(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\]\s{2}ERROR\s{2}Error!$/),
  );
  transportLevelInfo.log({ level: 'warn', message: 'Warn!' });
  expect(console.warn).toHaveBeenCalledWith(
    expect.stringMatching(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\]\s{2}WARN\s{3}Warn!$/),
  );
  transportLevelInfo.log({ level: 'info', message: 'Info' });
  expect(console.info).toHaveBeenCalledWith(
    expect.stringMatching(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\]\s{2}INFO\s{3}Info$/),
  );
  transportLevelInfo.log({ level: 'debug', message: 'Debug' });
  expect(console.debug).not.toHaveBeenCalledWith(
    expect.stringMatching(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\]\s{2}DEBUG\s{2}Debug$/),
  );
});

it('should correctly stringify complex context objects', () => {
  const transport = new ConsoleTransport();

  transport.log({ level: 'info', message: 'empty context', context: {} });
  expect(console.info).toHaveBeenCalledWith(
    expect.stringMatching(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\]\s{2}INFO\s{3}empty context$/),
  );

  const apiError = new APIError('network_error', 'get_user', new FetchError('foo error', {
    status: 418,
    statusText: 'foo',
  }));

  transport.log(
    {
      level: 'info',
      message: 'complex context',
      context: {
        string: 'string',
        number: 1,
        boolean: true,
        undefined: 'undefined',
        array: ['foo', { foo: 'bar' }],
        object: { foo: 'bar' },
        apiError,
        [Symbol('some-symbol')]: Symbol('some-symbol'),
      },
    },
  );
  expect(console.info).toHaveBeenCalledWith(
    expect.stringMatching(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\]\s{2}INFO\s{3}complex context\s{2}\(string: string, number: 1, boolean: true, undefined: undefined, array: \["foo",\{"foo":"bar"\}\], object: \{"foo":"bar"\}, apiError: \{"name":"API Error","message":"No response from server, please check if you are correctly connected to internet","httpCode":418,"httpStatusText":"foo","stack":/),
  );
});
