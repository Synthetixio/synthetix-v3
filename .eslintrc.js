module.exports = {
  extends: ['eslint:recommended'],
  env: {
    mocha: true,
    node: true,
  },
  globals: {
    hre: 'writable',
    Proxy: 'readonly',
    Promise: 'readonly',
  },
  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
    indent: ['error', 2],
    'linebreak-style': ['error', 'unix'],
    quotes: ['error', 'single', { allowTemplateLiterals: true }],
    semi: ['error', 'always'],
    'no-inner-declarations': 'off',
    'max-len': ['error', { code: 160, comments: 100 }],
  },
};
