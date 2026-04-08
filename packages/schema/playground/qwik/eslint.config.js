import { storyblokLintConfig } from '@storyblok/eslint-config';
import { qwikEslint9Plugin } from 'eslint-plugin-qwik';

const qwikConfigs = qwikEslint9Plugin.configs.recommended.map(config => ({
  ...config,
  files: ['**/*.ts', '**/*.tsx'],
  languageOptions: {
    ...config.languageOptions,
    parserOptions: {
      ...config.languageOptions?.parserOptions,
      project: './tsconfig.json',
    },
  },
}));

export default storyblokLintConfig(
  {},
  ...qwikConfigs,
  {
    files: ['src/schema/push.ts', 'src/seeds/push.ts'],
    rules: {
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
    },
  },
);
