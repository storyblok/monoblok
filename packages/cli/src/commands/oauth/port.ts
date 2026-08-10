import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const EXEC_OPTIONS = { timeout: 2000, windowsHide: true } as const;

export interface PortHolder {
  pid: number;
  name?: string;
}

// `lsof -Fpc` prints one field per line, prefixed by its type: `p<pid>` then `c<command>`.
const parseLsof = (stdout: string): PortHolder | undefined => {
  let pid: number | undefined;
  let name: string | undefined;
  for (const line of stdout.split('\n')) {
    if (line.startsWith('p') && pid === undefined) {
      pid = Number.parseInt(line.slice(1), 10);
    }
    else if (line.startsWith('c') && name === undefined) {
      name = line.slice(1).trim();
    }
  }
  return pid && Number.isFinite(pid) ? { pid, name } : undefined;
};

const findHolderUnix = async (port: number): Promise<PortHolder | undefined> => {
  const { stdout } = await run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fpc'], EXEC_OPTIONS);
  return parseLsof(stdout);
};

const findHolderWindows = async (port: number): Promise<PortHolder | undefined> => {
  const { stdout } = await run('netstat', ['-ano', '-p', 'TCP'], EXEC_OPTIONS);
  const row = stdout.split('\n').find((line) => {
    const columns = line.trim().split(/\s+/);
    // Columns: Proto, Local Address, Foreign Address, State, PID.
    return columns.length >= 5 && columns[3] === 'LISTENING' && columns[1].endsWith(`:${port}`);
  });
  const pid = row ? Number.parseInt(row.trim().split(/\s+/)[4], 10) : Number.NaN;
  if (!Number.isFinite(pid)) {
    return undefined;
  }

  try {
    const { stdout: tasks } = await run('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], EXEC_OPTIONS);
    const name = tasks.trim().split('","')[0]?.replace(/^"/, '');
    return { pid, name: name || undefined };
  }
  catch {
    // The PID alone is still actionable.
    return { pid };
  }
};

// Best-effort lookup of the process listening on a port. Shelling out to lsof/netstat can
// fail for any number of reasons (tool missing, permissions, timeout); the caller degrades
// to a generic message rather than turning a diagnostic into a second failure.
export const findPortHolder = async (port: number): Promise<PortHolder | undefined> => {
  try {
    return process.platform === 'win32' ? await findHolderWindows(port) : await findHolderUnix(port);
  }
  catch {
    return undefined;
  }
};

const lookupHint = (port: number): string => {
  return process.platform === 'win32'
    ? `netstat -ano -p TCP | findstr :${port}`
    : `lsof -nP -iTCP:${port} -sTCP:LISTEN`;
};

const stopHint = (pid: number): string => {
  return process.platform === 'win32' ? `taskkill /PID ${pid} /F` : `kill ${pid}`;
};

// The OAuth app registers one exact redirect URI, so the CLI cannot retry on a free port.
// Name whatever holds the port instead of surfacing a bare EADDRINUSE.
export const describePortConflict = async (port: number): Promise<string> => {
  const holder = await findPortHolder(port);
  const culprit = holder
    ? (holder.name ? `by ${holder.name} (PID ${holder.pid})` : `by PID ${holder.pid}`)
    : 'by another process';

  const resolution = holder
    ? `Stop that process (\`${stopHint(holder.pid)}\`) and run \`storyblok login --oauth\` again.`
    : `Find it with \`${lookupHint(port)}\`, stop it, and run \`storyblok login --oauth\` again.`;

  return `Port ${port} is already in use ${culprit}, so the CLI cannot receive the OAuth callback.\n`
    + `The redirect URI is registered for this exact port, so the CLI cannot switch to a free one.\n`
    + `${resolution}`;
};
