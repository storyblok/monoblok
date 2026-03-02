import { OpenAPIServer } from '@ivotoby/openapi-mcp-server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

interface MakeMcpOptions {
  space?: string;
  authToken?: string;
}

export async function makeMCP(
  inlineSpecContent: string,
  { space, authToken }: MakeMcpOptions = {},
): Promise<void> {
  let specProcessed = inlineSpecContent;
  if (space) {
    specProcessed = specProcessed.replaceAll('/{space_id}', `/${space}`);
    specProcessed = specProcessed.replaceAll('- $ref: \'#/components/parameters/space_id\'', '');
  }
  try {
    const config = {
      name: 'storyblok-mapi-client',
      version: '1.0.0',
      apiBaseUrl: 'https://mapi.storyblok.com',
      inlineSpecContent: specProcessed,
      specInputMethod: 'inline',
      headers: {
        'Authorization': authToken,
        'Content-Type': 'application/json',
      },
      transportType: 'stdio',
      toolsMode: 'all',
    };

    const server = new OpenAPIServer(config);
    const transport = new StdioServerTransport();

    await server.start(transport);
  }
  catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}
