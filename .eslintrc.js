module.exports = {
  extends: ['eslint:recommended'],
  env: {
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
  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
    'no-only-tests/no-only-tests': 'error',
    indent: ['error', 2],
    'linebreak-style': ['error', 'unix'],
    quotes: ['error', 'single'],
    semi: ['error', 'always'],
    'no-inner-declarations': 'off',
    'max-len': ['error', { code: 160, comments: 100 }],
    'max-params': ['error', 3], // If a function requires more than 3 parameters, please compact them using objects: { param1, param2, param3 }
  },
};
