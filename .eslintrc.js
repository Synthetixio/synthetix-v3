module.exports = {
  root: true,
  extends: ['eslint:recommended'],
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
  plugins: ['progress', 'no-only-tests'],
  parserOptions: {
    ecmaVersion: 12,
  },
  ignorePatterns: ['/*.js'],
  rules: {
    'progress/enable': process.env.ESLINT_PROGRESS === 'true' ? 1 : 0,
    indent: 'off', // prettier
    'no-only-tests/no-only-tests': 'error',
    'linebreak-style': 'off', // prettier
    quotes: 'off', // prettier
    semi: 'off', // prettier
    'no-inner-declarations': 'off',
    'max-len': 'off', // prettier
  },
  overrides: [
    {
      files: ['**/*.ts'],
      extends: ['plugin:@typescript-eslint/recommended'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
      },
      rules: {
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/no-var-requires': 0,
        '@typescript-eslint/no-non-null-assertion': 0,
        '@typescript-eslint/no-empty-function': 0,
      },
    },
    {
      files: [
        './utils/*/test/**/*.{j,t}s',
        './markets/*/test/**/*.{j,t}s',
        './protocol/*/test/**/*.{j,t}s',
      ],
      env: {
        mocha: true,
      },
    },

    {
      files: ['protocol/synthetix/subgraph/**/*'],
      env: {},
      globals: {
        changetype: true,
        i32: true,
        i64: true,
        assert: true,
      },
      rules: {
        'prefer-const': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/ban-types': 'off',
        '@typescript-eslint/no-array-constructor': 'off',
      },
    },
  ],
};
