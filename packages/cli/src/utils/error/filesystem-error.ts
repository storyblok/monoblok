const FS_ERRORS = {
  file_not_found: 'The file requested was not found',
  permission_denied: 'Permission denied while accessing the file',
  operation_on_directory: 'The operation is not allowed on a directory',
  not_a_directory: 'The path provided is not a directory',
  file_already_exists: 'The file already exists',
  directory_not_empty: 'The directory is not empty',
  too_many_open_files: 'Too many open files',
  no_space_left: 'No space left on the device',
  invalid_argument: 'An invalid argument was provided',
  unknown_error: 'An unknown error occurred',
} as const;

const FS_ACTIONS = {
  read: 'Failed to read/parse file:',
  write: 'Writing file',
  delete: 'Deleting file',
  mkdir: 'Creating directory',
  rmdir: 'Removing directory',
  authorization_check: 'Failed to check authorization in .netrc file:',
} as const;

export function handleFileSystemError(action: keyof typeof FS_ACTIONS, error: NodeJS.ErrnoException): void {
  if (error.code) {
    switch (error.code) {
      case 'ENOENT':
        throw new FileSystemError('file_not_found', action, error);
      case 'EACCES':
      case 'EPERM':
        throw new FileSystemError('permission_denied', action, error);
      case 'EISDIR':
        throw new FileSystemError('operation_on_directory', action, error);
      case 'ENOTDIR':
        throw new FileSystemError('not_a_directory', action, error);
      case 'EEXIST':
        throw new FileSystemError('file_already_exists', action, error);
      case 'ENOTEMPTY':
        throw new FileSystemError('directory_not_empty', action, error);
      case 'EMFILE':
        throw new FileSystemError('too_many_open_files', action, error);
      case 'ENOSPC':
        throw new FileSystemError('no_space_left', action, error);
      case 'EINVAL':
        throw new FileSystemError('invalid_argument', action, error);
      default:
        throw new FileSystemError('unknown_error', action, error);
    }
  }
  else {
    // In case the error does not have a known `fs` error code, throw a general error
    throw new FileSystemError('unknown_error', action, error);
  }
}

export class FileSystemError extends Error {
  errorId: string;
  cause: string;
  code: string | undefined;
  messageStack: string[];
  error: NodeJS.ErrnoException | undefined;

  constructor(errorId: keyof typeof FS_ERRORS, action: keyof typeof FS_ACTIONS, error: NodeJS.ErrnoException, customMessage?: string) {
    super(customMessage || FS_ERRORS[errorId]);
    this.name = 'File System Error';
    this.errorId = errorId;
    this.cause = FS_ERRORS[errorId];
    this.code = error.code;
    this.messageStack = [];
    this.error = error;

    if (!customMessage) {
      this.messageStack.push(FS_ACTIONS[action]);
    }
    this.messageStack.push(customMessage || FS_ERRORS[errorId]);
  }

  getInfo() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      cause: this.cause,
      errorId: this.errorId,
      stack: this.stack,
    };
  }
}
