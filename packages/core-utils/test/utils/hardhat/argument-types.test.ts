import { doesNotThrow, equal, notEqual, throws } from 'assert/strict';

import { address, alphanumeric, oneOf } from '../../../src/utils/hardhat/argument-types';

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

  describe('address', () => {
    it('is well formed', () => {
      equal(address.name, 'address');
      notEqual(address.parse, undefined);
      notEqual(address.validate, undefined);
    });

    it('parses addresses correctly', () => {
      equal(
        address.parse('', '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'),
        '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'
      );
      equal(
        address.parse('', '0x23618e81e3f5cdf7f54c3d65f7fbc0abf5b21e8f'),
        '0x23618e81e3f5cdf7f54c3d65f7fbc0abf5b21e8f'
      );
    });

    it('validates correctly', () => {
      doesNotThrow(() => {
        address.validate('argName', '0x23618e81e3f5cdf7f54c3d65f7fbc0abf5b21e8f');
      });
      doesNotThrow(() => {
        address.validate('argName', '0x23618e81e3f5cdf7f54c3d65f7fbc0abf5b21e8f');
      });
      throws(() => {
        address.validate('argName', 'word.1234');
      });
      throws(() => {
        address.validate('argName', 'word 1234');
      });
      throws(() => {
        address.validate('argName', 'WORD 1234');
      });
      throws(() => {
        address.validate('argName', 1);
      });
    });
  });

  describe('oneOf', () => {
    const type = oneOf('one', 'two');

    it('is well formed', () => {
      equal(type.name, 'oneOf');
      notEqual(type.parse, undefined);
      notEqual(type.validate, undefined);
    });

    it('parses values correctly', () => {
      equal(type.parse('arg', 'one'), 'one');
      equal(type.parse('arg', '2'), '2');
    });

    it('validates correctly', () => {
      doesNotThrow(() => {
        type.validate('argName', 'one');
      });
      doesNotThrow(() => {
        type.validate('argName', 'two');
      });
      throws(() => {
        type.validate('argName', 1);
      });
      throws(() => {
        type.validate('argName', undefined);
      });
      throws(() => {
        type.validate('argName', 'something');
      });
      throws(() => {
        type.validate('argName', {});
      });
    });
  });
});
