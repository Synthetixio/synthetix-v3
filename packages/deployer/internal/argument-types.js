const { ERRORS } = require('hardhat/internal/core/errors-list');
const { HardhatError } = require('hardhat/internal/core/errors');

const alphanumeric = {
  name: 'word',
  parse: (argName, value) => (typeof value === 'string' ? value.toLowerCase() : value),
  validate: (argName, value) => {
    const valid = typeof value === 'string' && /^[a-z0-9]+$/.test(value);
    if (!valid) {
      throw new HardhatError(ERRORS.ARGUMENTS.INVALID_VALUE_FOR_TYPE, {
        value,
        name: argName,
        type: alphanumeric.name,
      });
    }
  },
};

module.exports = {
  alphanumeric,
};
