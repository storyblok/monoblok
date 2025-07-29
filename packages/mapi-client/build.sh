#!/bin/bash

OPENAPI_PATH=$(pnpm --filter @storyblok/openapi list --json | jq ".[0].path" | tr -d '"')

# Find all yaml files in the resources folder
RESOURCES=$(find $OPENAPI_PATH/dist -name "*.yaml")

# Generate a client for each resource
for resource in $RESOURCES; do
  RESOURCE_NAME=$(basename $resource .yaml)
  echo "Generating client for $RESOURCE_NAME..."
  
  # Create a temporary config for this resource
  cat > temp-config.ts << EOF
import { defaultPlugins } from '@hey-api/openapi-ts';

export default {
  input: '$resource',
  output: 'src/generated/$RESOURCE_NAME',
  plugins: [
    "@hey-api/schemas",
    "@hey-api/client-fetch",
    {
      enums: 'javascript',
      name: '@hey-api/typescript',
    },
    {
      asClass: false,
      client: true,
      name: '@hey-api/sdk',
    },
  ],
};
EOF

  # Generate the client
  npx @hey-api/openapi-ts -f temp-config.ts
  
  # Clean up
  rm temp-config.ts
done
