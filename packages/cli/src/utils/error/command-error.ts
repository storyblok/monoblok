export class CommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Command Error';
  }

  getInfo() {
    return {
      name: this.name,
      message: this.message,
      stack: this.stack,
    };
  }
}
