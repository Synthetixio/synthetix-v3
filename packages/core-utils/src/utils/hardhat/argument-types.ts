import { ERRORS } from 'hardhat/internal/core/errors-list';
import { HardhatError } from 'hardhat/internal/core/errors';

export const alphanumeric = {
  name: 'word',
  parse: (argName: string, value: unknown) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  validate: (argName: string, value: unknown) => {
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

export const address = {
  name: 'address',
  parse: (argName: string, value: unknown) => value,
  validate: (argName: string, value: unknown) => {
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

export const oneOf = (...values: string[]) => ({
  name: 'oneOf',
  parse: (argName: string, value: string) => value,
  validate: (argName: string, value: string) => {
    if (!values.includes(value)) {
      throw new HardhatError(ERRORS.ARGUMENTS.INVALID_VALUE_FOR_TYPE, {
        value,
        name: argName,
        type: `oneOf(${values.join('|')})`,
      });
    }
  },
});
