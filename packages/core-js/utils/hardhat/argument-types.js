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

const address = {
  name: 'address',
  parse: (argName, value) => value,
  validate: (argName, value) => {
    const valid = typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value);
    if (!valid) {
      throw new HardhatError(ERRORS.ARGUMENTS.INVALID_VALUE_FOR_TYPE, {
        value,
        name: argName,
        type: address.name,
      });
    }
  },
};

const oneOf = (...values) => ({
  name: 'oneOf',
  parse: (argName, value) => value,
  validate: (argName, value) => {
    if (!values.includes(value)) {
      throw new HardhatError(ERRORS.ARGUMENTS.INVALID_VALUE_FOR_TYPE, {
        value,
        name: argName,
        type: `oneOf(${values.join('|')})`,
      });
    }
  },
});

module.exports = {
  alphanumeric,
  address,
  oneOf,
};
