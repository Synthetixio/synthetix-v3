const { equal, deepEqual } = require('assert/strict');
const logger = require('../../utils/logger');

describe('utils/logger.js', () => {
  let logged = [];

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
        ['\u001b[90mⓘ  hello\u001b[39m'],
        ['\u001b[33m> hello\u001b[39m'],
        ['\u001b[31m\u001b[1m\u001b[7m☠ hello\u001b[27m\u001b[22m\u001b[39m'],
        ['\u001b[33m\u001b[1m\u001b[7m⚠ hello\u001b[27m\u001b[22m\u001b[39m'],
        ['\u001b[90m✓ hello\u001b[39m'],
        ['\u001b[32m✅ hello\u001b[39m'],
        ['\u001b[32m\u001b[1m💯 hello\u001b[22m\u001b[39m'],
        ['\n'],
        [
          '\u001b[36m\u001b[1m┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\u001b[22m\u001b[39m',
        ],
        [
          '\u001b[36m\u001b[1m┃ \u001b[22m\u001b[39m\u001b[36m‣ hello\u001b[39m\u001b[90m........................................................' +
            '.........................\u001b[39m\u001b[36m\u001b[1m ┃\u001b[22m\u001b[39m',
        ],
        [
          '\u001b[36m\u001b[1m┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\u001b[22m\u001b[39m',
        ],
        [
          '\u001b[36m\u001b[1m┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\u001b[22m\u001b[39m',
        ],
        [
          '\u001b[36m\u001b[1m┃ \u001b[22m\u001b[39mboxed hello\u001b[90m..........................................................................' +
            '.............\u001b[39m\u001b[36m\u001b[1m ┃\u001b[22m\u001b[39m',
        ],
        [
          '\u001b[36m\u001b[1m┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\u001b[22m\u001b[39m',
        ],
      ]);
    });

    it('should log when debugging is enabled', () => {
      logger.debugging = true;
      try {
        logger.debug('debugging!');
        deepEqual(logged, [['\u001b[35mdebugging!\u001b[39m']]);
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
