module.exports = {
  root: true,
  extends: ['eslint:recommended', 'prettier'],
  env: {
    es2020: true,
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
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.eslint.json'],
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    'no-only-tests/no-only-tests': 'error',
    indent: ['error', 2],
    'linebreak-style': 0,
    quotes: ['error', 'single'],
    semi: ['error', 'always'],
    'no-inner-declarations': 'off',
    'max-len': ['error', { code: 160, comments: 100 }],
  },
  overrides: [
    {
      files: ['**/*.ts'],
      extends: ['plugin:@typescript-eslint/recommended'],
      parserOptions: {
        project: ['./tsconfig.json'],
      },
      rules: {
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/no-var-requires': 0,
        '@typescript-eslint/no-non-null-assertion': 0,
        '@typescript-eslint/no-empty-function': 0,
      },
    },
    {
      files: ['./packages/*/test/**/*.{j,t}s'],
      env: {
        mocha: true,
      },
    },
  ],
};
