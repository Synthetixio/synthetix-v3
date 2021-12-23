const { equal, notEqual, throws, doesNotThrow } = require('assert/strict');
const { alphanumeric } = require('../../../utils/hardhat/argument-types');

describe('utils/hardhat/argument-types.js', function () {
  describe('alphanumeric', () => {
    it('is well formed', () => {
      equal(alphanumeric.name, 'word');
      notEqual(alphanumeric.parse, undefined);
      notEqual(alphanumeric.validate, undefined);
    });

    it('parses strings correctly', () => {
      equal(alphanumeric.parse('', 'WORD'), 'word');
      equal(alphanumeric.parse('', 'word'), 'word');
      equal(alphanumeric.parse('', 5), 5);
    });

    it('validates correctly', () => {
      doesNotThrow(() => {
        alphanumeric.validate('argName', 'word1234');
      });
      doesNotThrow(() => {
        alphanumeric.validate('argName', '12numbers21mixed');
      });
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
