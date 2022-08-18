const assert = require('assert/strict');
const del = require('del');
const fs = require('fs');
const autosaveObject = require('../../../internal/autosave-object');
const { default: logger } = require('@synthetixio/core-js/dist/utils/io/logger');

const FILE_PATH = 'test/fixtures/files/autosave.json';
const INITIAL_OBJ = {
  value: 42,
  thing: 'hello',
  sub: null,
};

describe('internal/autosave-object.js', function () {
  let obj;
  let logs = '';

  function _fileContains(str) {
    const txt = fs.readFileSync(FILE_PATH);
    assert.ok(txt.includes(str));
  }

  function _logsContain(str) {
    assert.ok(logs.includes(str));
  }

  before('configure logger', async function () {
    logger.quiet = false;
    logger.debugging = true;
    logger._log = (...args) => {
      logs += `${args}`;
    };
  });

  describe('when initialized with an undefined file path', function () {
    it('throws an error', async function () {
      assert.throws(() => autosaveObject(), { message: 'Missing filepath' });
    });
  });

  describe('when initialized with a valid file path', function () {
    describe('when the file exists', function () {
      before('initialize', async function () {
        obj = autosaveObject(FILE_PATH, INITIAL_OBJ);
      });

      it('reads the object', async function () {
        assert.equal(obj.value, 42);
      });
    });

    describe('when the file does not exist', function () {
      before('delete any previously existing files', async function () {
        await del(FILE_PATH);
      });

      before('initialize', async function () {
        obj = autosaveObject(FILE_PATH, INITIAL_OBJ);
      });

      it('creates the file', async function () {
        assert.ok(fs.existsSync(FILE_PATH));
      });
    });

    before('initialize', async function () {
      obj = autosaveObject(FILE_PATH, INITIAL_OBJ);
    });

    after('restore object', async function () {
      obj.value = 42;
      obj.sub = null;
    });

    it('logged opening the file', async function () {
      _logsContain(`Opened: ${FILE_PATH}`);
    });

    it('initializes the file with the appropriate state', async function () {
      _fileContains('"value": 42');
      _fileContains('"thing": "hello"');
    });

    describe('when changing a value in the object', function () {
      before('alter the obj in javascript', async function () {
        obj.value = 1337;
      });

      it('modifies the file', async function () {
        _fileContains('"value": 1337');
      });

      it('sets the value in the object', async function () {
        assert.equal(obj.value, 1337);
      });

      it('logs modifying the file', async function () {
        _logsContain('Setting property:');
        _logsContain('> key: value');
        _logsContain('> value: 1337');
        _logsContain('File saved');
      });

      describe('when setting the same value on the object', function () {
        before('set same value', async function () {
          obj.value = 1337;
        });

        it('reports not change', async function () {
          _logsContain('No changes - skipping write to file');
        });
      });
    });

    describe('when adding a sub-object to the object', function () {
      let sub = {
        exists: true,
      };

      before('add sub-object', async function () {
        obj.sub = sub;
      });

      it('sets the value in the object', async function () {
        assert.deepEqual(obj.sub, sub);
      });

      it('writes to the file', async function () {
        _fileContains('"sub": {');
        _fileContains('"exists": true');
      });
    });
  });
});
