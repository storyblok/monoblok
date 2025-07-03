const baseConfig = [

  // General Rules
  {
    name: 'storyblok:general',
    rules: {
      'curly': ['error', 'all'],
      'style/function-call-spacing': ['error', 'never'],
      'node/prefer-global/process': 'off',
      'antfu/top-level-function': 'off',
      'perfectionist/sort-imports': 'off',
    },
  },

  // Vue Rules
  {
    name: 'storyblok:vue',
    files: ['**/*.vue'],
    rules: {
      'vue/max-attributes-per-line': ['error', {
        singleline: { max: 10 },
        multiline: { max: 1 },
      }],
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': ['warn', {
        html: {
          void: 'always',
          normal: 'never',
        },
      }],
    },
  },
];

export default baseConfig;
