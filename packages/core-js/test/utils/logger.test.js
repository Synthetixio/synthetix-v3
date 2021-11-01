const { equal, deepEqual } = require('assert/strict');
const chalk = require('chalk');
const logger = require('../../utils/logger');

describe('utils/logger.js', () => {
  let logged = [];

  before('disable chalk color usage', () => {
    chalk.level = 0;
  });

  before('capture output', () => {
    logger._log = (...args) => {
      logged.push(args);
    };
  });

  beforeEach('reset captured output', () => {
    logged = [];
  });

  it('starts with the correct default props', () => {
    equal(logger.quiet, false);
    equal(logger.debugging, false);
    equal(logger.prepend, '');
    equal(logger.postpend, '');
    equal(logger.boxing, false);
  });

  describe('when quiet is not enabled', () => {
    before('disable quiet', () => {
      logger.quiet = false;
    });

    it('does not record any logs', () => {
      logger.log('hello');
      logger.info('hello');
      logger.notice('hello');
      logger.error('hello');
      logger.warn('hello');
      logger.checked('hello');
      logger.success('hello');
      logger.complete('hello');
      logger.debug('hello');
      logger.subtitle('hello');
      logger.boxStart();
      logger.log('boxed hello');
      logger.boxEnd();

      deepEqual(logged, [
        ['hello'],
        ['ⓘ  hello'],
        ['> hello'],
        ['☠ hello'],
        ['⚠ hello'],
        ['✓ hello'],
        ['✅ hello'],
        ['💯 hello'],
        ['\n'],
        [
          '┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓',
        ],
        [
          '┃ ‣ hello........................................................................................... ┃',
        ],
        [
          '┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛',
        ],
        [
          '┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓',
        ],
        [
          '┃ boxed hello....................................................................................... ┃',
        ],
        [
          '┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛',
        ],
      ]);
    });

    it('should log when debugging is enabled', () => {
      logger.debugging = true;
      try {
        logger.debug('debugging!');
        deepEqual(logged, [['debugging!']]);
      } finally {
        logger.debugging = false;
      }
    });
  });

  describe('when quiet is enabled', () => {
    before('enable quiet', () => {
      logger.quiet = true;
    });

    it('does not record any logs', () => {
      logger.log('hello');
      logger.info('hello');
      logger.notice('hello');
      logger.error('hello');
      logger.warn('hello');
      logger.checked('hello');
      logger.success('hello');
      logger.complete('hello');
      logger.debug('hello');
      logger.subtitle('hello');
      logger.boxStart();
      logger.log('boxed hello');
      logger.boxEnd();

      equal(logged.length, 0);
    });
  });
});
