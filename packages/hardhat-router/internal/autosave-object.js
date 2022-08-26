const fs = require('fs');
const { default: logger } = require('@synthetixio/core-utils/utils/io/logger');
const { default: relativePath } = require('@synthetixio/core-utils/utils/misc/relative-path');
const debounce = require('lodash.debounce');

const write = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

/**
 * Create or load an object from a JSON file, and update the file on any changes
 * @param {string} file
 * @param {Object} [initialState] optional initial data if file does not exist
 * @returns {Object}
 */
module.exports = function autosaveObject(file, initialState = {}) {
  if (!file) {
    throw new Error('Missing filepath');
  }

  logger.debug(`Opened: ${relativePath(file)}`);

  if (!fs.existsSync(file)) {
    write(file, initialState);
  }

  const data = JSON.parse(fs.readFileSync(file));

  const _write = debounce(() => write(file, data), 0);

  const handler = {
    get: (target, key) => {
      if (typeof target[key] === 'object' && target[key] !== null) {
        return new Proxy(target[key], handler);
      } else {
        return target[key];
      }
    },

    set: (target, key, value) => {
      const now = Date.now();
      logger.debug('Setting property:');
      logger.debug(`  > key: ${key}`);
      logger.debug(`  > value: ${JSON.stringify(value)}`);

      if (target[key] === value) {
        logger.debug('No changes - skipping write to file');
      } else {
        target[key] = value;
        _write(file, data);
        logger.debug(`File saved (${Date.now() - now}ms): ${relativePath(file)}`);
      }

      return true;
    },
  };

  return new Proxy(data, handler);
};
