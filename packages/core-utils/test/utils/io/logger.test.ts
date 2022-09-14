import chalk from 'chalk';
import { deepEqual, equal } from 'assert/strict';

import logger from '../../../src/utils/io/logger';

describe('utils/io/prompter.ts', function () {
  let logged: unknown[][] = [];

  before('disable chalk color usage', function () {
    chalk.level = 0;
  });

  before('capture output', function () {
    logger._log = (...args) => {
      logged.push(args);
    };
  });

  beforeEach('reset captured output', function () {
    logged = [];
  });

  it('starts with the correct default props', function () {
    equal(logger.quiet, false);
    equal(logger.debugging, false);
    equal(logger.prepend, '');
    equal(logger.postpend, '');
    equal(logger.boxing, false);
  });

  describe('when quiet is not enabled', function () {
    before('disable quiet', function () {
      logger.quiet = false;
    });

    it('prints logs to the console', function () {
      logger.log('hello');
      logger.info('hello');
      logger.notice('hello');
      logger.error('hello');
      logger.warn('hello');
      logger.checked('hello');
      logger.success('hello');
      logger.complete('hello');
      logger.debug('hello');
      logger.title('hello');
      logger.subtitle('hello');
      logger.boxStart();
      logger.log('boxed hello');
      logger.boxEnd();

      deepEqual(logged, [
        ['hello'],
        ['ⓘ  hello'],
        ['! hello'],
        ['☠ hello'],
        ['⚠ hello'],
        ['✓ hello'],
        ['✅ hello'],
        ['💯 hello'],
        ['hello'],
        ['\n'],
        [
          '┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓',
        ],
        [
          '┃ ‣ hello                                                                                            ┃',
        ],
        [
          '┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛',
        ],
        [
          '┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓',
        ],
        [
          '┃ boxed hello                                                                                        ┃',
        ],
        [
          '┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛',
        ],
      ]);
    });

    it('should log when debugging is enabled', function () {
      logger.debugging = true;
      try {
        logger.debug('debugging!');
        deepEqual(logged, [['debugging!']]);
      } finally {
        logger.debugging = false;
      }
    });
  });

  describe('when quiet is enabled', function () {
    before('enable quiet', function () {
      logger.quiet = true;
    });

    it('does not record any logs', function () {
      logger.log('hello');
      logger.info('hello');
      logger.notice('hello');
      logger.error('hello');
      logger.warn('hello');
      logger.checked('hello');
      logger.success('hello');
      logger.complete('hello');
      logger.debug('hello');
      logger.title('hello');
      logger.subtitle('hello');
      logger.boxStart();
      logger.log('boxed hello');
      logger.boxEnd();

      equal(logged.length, 0);
    });
  });
});
