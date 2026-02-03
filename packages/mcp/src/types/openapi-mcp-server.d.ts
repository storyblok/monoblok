declare module '@ivotoby/openapi-mcp-server' {
  export class OpenAPIServer {
    constructor(config: Record<string, unknown>);
    start(transport: unknown): Promise<void>;
  }
}
