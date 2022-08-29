module.exports = {
  root: true,
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  env: {
    es2020: true,
    mocha: true,
    node: true,
    es6: true,
  },
  globals: {
    hre: 'writable',
    Proxy: 'readonly',
    Promise: 'readonly',
  },
  plugins: ['no-only-tests'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
    'no-only-tests/no-only-tests': 'error',
    indent: ['error', 2],
    'linebreak-style': 0,
    quotes: ['error', 'single'],
    semi: ['error', 'always'],
    'no-inner-declarations': 'off',
    'max-len': ['error', { code: 160, comments: 100 }],
    'max-params': ['error', 5], // If a function requires more than 3 parameters, please compact them using objects: { param1, param2, param3 }
    '@typescript-eslint/no-empty-function': 0,
  },
  overrides: [
    {
      files: ['*.js'],
      rules: {
        '@typescript-eslint/no-var-requires': 0,
      },
    },
  ],
};
