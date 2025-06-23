import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  declaration: true,
  entries: ['./src/index'],
  failOnWarn: false,
  sourcemap: true,
});
