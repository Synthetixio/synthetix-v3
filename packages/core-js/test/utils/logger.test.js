const assert = require('assert/strict');
const logger = require('../../utils/logger');

describe('utils/logger.js', () => {
  let logCache;
  let logged = '';

  function _log(msg) {
    logged += msg;
  }

  before('capture output', async () => {
    logCache = console.log;
    console.log = _log;
  });

  after('release output', async () => {
    console.log = logCache;
  });

  it('starts with the correct default props', async () => {
    assert.equal(logger.quiet, false);
    assert.equal(logger.debugging, false);
    assert.equal(logger.prepend, '');
    assert.equal(logger.postpend, '');
    assert.equal(logger.boxing, false);
  });

  describe('when quiet is enabled', () => {
    before('enable quiet', async () => {
      logger.quiet = true;
    });

    before('perform some logs', async () => {
      logger.log('hello');
      logger.info('hello');
      logger.notice('hello');
      logger.error('hello');
      logger.warn('hello');
      logger.checked('hello');
      logger.success('hello');
      logger.complete('hello');
      logger.debug('hello');
    });

    it('does not record any logs', async () => {
      assert.equal(logged.length, 0);
    });
  });
});
