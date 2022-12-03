import { deepEqual, doesNotThrow, equal, notEqual, throws } from 'node:assert/strict';
import {
  address,
  alphanumeric,
  oneOf,
  stringArray,
} from '../../../src/utils/hardhat/argument-types';

describe('utils/hardhat/argument-types.ts', function () {
  describe('alphanumeric', function () {
    it('is well formed', function () {
      equal(alphanumeric.name, 'word');
      notEqual(alphanumeric.parse, undefined);
      notEqual(alphanumeric.validate, undefined);
    });

    it('parses strings correctly', function () {
      equal(alphanumeric.parse('', 'WORD'), 'word');
      equal(alphanumeric.parse('', 'word'), 'word');
      equal(alphanumeric.parse('', '5'), '5');
    });

    it('validates correctly', function () {
      doesNotThrow(() => {
        address.validate('argName', '0x23618e81e3f5cdf7f54c3d65f7fbc0abf5b21e8f');
      });
      doesNotThrow(() => {
        address.validate('argName', '0x23618e81e3f5cdf7f54c3d65f7fbc0abf5b21e8f');
      });
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
    });
  });

  describe('address', function () {
    it('is well formed', function () {
      equal(address.name, 'address');
      notEqual(address.parse, undefined);
      notEqual(address.validate, undefined);
    });

    it('parses addresses correctly', function () {
      equal(
        address.parse('', '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'),
        '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'
      );
      equal(
        address.parse('', '0x23618e81e3f5cdf7f54c3d65f7fbc0abf5b21e8f'),
        '0x23618e81e3f5cdf7f54c3d65f7fbc0abf5b21e8f'
      );
    });

    it('validates correctly', function () {
      throws(() => {
        address.validate('argName', 'word.1234');
      });
      throws(() => {
        address.validate('argName', 'word 1234');
      });
      throws(() => {
        address.validate('argName', 'WORD 1234');
      });
    });
  });

  describe('oneOf', function () {
    const type = oneOf('one', 'two');

    it('is well formed', function () {
      equal(type.name, 'oneOf');
      notEqual(type.parse, undefined);
      notEqual(type.validate, undefined);
    });

    it('parses values correctly', function () {
      equal(type.parse('arg', 'one'), 'one');
      equal(type.parse('arg', '2'), '2');
    });

    it('validates correctly', function () {
      doesNotThrow(() => {
        type.validate('argName', 'one');
      });
      doesNotThrow(() => {
        type.validate('argName', 'two');
      });
      throws(() => {
        type.validate('argName', 1 as unknown as string);
      });
      throws(() => {
        type.validate('argName', undefined as unknown as string);
      });
      throws(() => {
        type.validate('argName', 'something');
      });
      throws(() => {
        type.validate('argName', {} as unknown as string);
      });
    });
  });

  describe('stringArray', function () {
    it('is well formed', function () {
      equal(stringArray.name, 'stringArray');
      notEqual(stringArray.parse, undefined);
      notEqual(stringArray.validate, undefined);
    });

    it('parses strings correctly', function () {
      deepEqual(stringArray.parse('', 'Something'), ['Something']);
      deepEqual(stringArray.parse('', 'two,things'), ['two', 'things']);
      deepEqual(stringArray.parse('', ', , two,things,'), ['two', 'things']);
      deepEqual(stringArray.parse('', ''), []);
    });

    it('validates correctly', function () {
      doesNotThrow(() => {
        stringArray.validate('argName', ['word1234']);
      });
      doesNotThrow(() => {
        stringArray.validate('argName', ['two', 'things']);
      });
      throws(() => {
        stringArray.validate('argName', '' as unknown as string[]);
      });
      throws(() => {
        stringArray.validate('argName', 3 as unknown as string[]);
      });
      throws(() => {
        stringArray.validate('argName', false as unknown as string[]);
      });
    });
  });
});
