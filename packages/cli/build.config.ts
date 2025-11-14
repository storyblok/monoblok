import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  declaration: true,
  entries: [
    './src/index',
    {
      input: './src/entrypoints/config',
      name: 'config/index',
    },
  ],
  failOnWarn: false,
  sourcemap: true,
});
