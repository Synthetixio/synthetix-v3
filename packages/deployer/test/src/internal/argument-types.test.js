const { equal, notEqual, throws } = require('assert/strict');
const { alphanumeric } = require('../../../internal/argument-types');

describe('internal/argument-types.js', function () {
  describe('alphanumeric', () => {
    it('is well formed', () => {
      equal(alphanumeric.name, 'word');
      notEqual(alphanumeric.parse, undefined);
      notEqual(alphanumeric.validate, undefined);
    });
    it('parses strings correctly', () => {
      equal(alphanumeric.parse('', 'WORD'), 'word');
      equal(alphanumeric.parse('', 'word'), 'word');
    });
    it('validates correctly', () => {
      equal(alphanumeric.validate('argName', 'word1234'), undefined);
      throws(() => {
        alphanumeric.validate('argName', 'word.1234');
      });
      throws(() => {
        alphanumeric.validate('argName', 'word 1234');
      });
      throws(() => {
        alphanumeric.validate('argName', 'WORD 1234');
      });
      throws(() => {
        alphanumeric.validate('argName', 1);
      });
    });
  });
});
