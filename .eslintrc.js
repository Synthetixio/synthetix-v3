module.exports = {
  extends: ['eslint:recommended'],
  env: {
    mocha: true,
    node: true,
  },
  globals: {
    hre: 'writable',
  },
  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
    indent: ['error', 2],
    'linebreak-style': ['error', 'unix'],
    quotes: ['error', 'single'],
    semi: ['error', 'always'],
    'no-inner-declarations': 'off',
  },
};
