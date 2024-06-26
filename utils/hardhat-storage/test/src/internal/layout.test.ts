import { getStorageSlotSize } from '../../../src/internal/layout';

describe('internal/layout.ts', function () {
  describe('#getStorageSlotSize', function () {
    it('should return correct size for "bool"', async function () {
      expect(getStorageSlotSize({ type: 'bool' })).toBe(1);
    });

    it('should return correct size for "address"', async function () {
      expect(getStorageSlotSize({ type: 'address' })).toBe(20);
    });

    it('should return correct size for "enum"', async function () {
      const arr = (length = 0) => new Array(length);

      expect(getStorageSlotSize({ type: 'enum', members: arr(1) })).toBe(1);
      expect(getStorageSlotSize({ type: 'enum', members: arr(256) })).toBe(1);
      expect(getStorageSlotSize({ type: 'enum', members: arr(257) })).toBe(2);

      expect(() => getStorageSlotSize({ type: 'enum', members: arr(0) })).toThrow(
        'Invalid enum size'
      );
    });

    it('should return correct size for "uint"', async function () {
      expect(getStorageSlotSize({ type: 'uint8' })).toBe(1);
      expect(getStorageSlotSize({ type: 'uint16' })).toBe(2);
      expect(getStorageSlotSize({ type: 'uint32' })).toBe(4);
      expect(getStorageSlotSize({ type: 'uint64' })).toBe(8);
      expect(getStorageSlotSize({ type: 'uint128' })).toBe(16);
      expect(getStorageSlotSize({ type: 'uint256' })).toBe(32);
      expect(() => getStorageSlotSize({ type: 'uint0' })).toThrow('Invalid type "uint0"');
      expect(() => getStorageSlotSize({ type: 'uint257' })).toThrow('Invalid type "uint257"');
    });

    it('should return correct size for "int"', async function () {
      expect(getStorageSlotSize({ type: 'int8' })).toBe(1);
      expect(getStorageSlotSize({ type: 'int16' })).toBe(2);
      expect(getStorageSlotSize({ type: 'int32' })).toBe(4);
      expect(getStorageSlotSize({ type: 'int64' })).toBe(8);
      expect(getStorageSlotSize({ type: 'int128' })).toBe(16);
      expect(getStorageSlotSize({ type: 'int256' })).toBe(32);
      expect(() => getStorageSlotSize({ type: 'int0' })).toThrow('Invalid type "int0"');
      expect(() => getStorageSlotSize({ type: 'int257' })).toThrow('Invalid type "int257"');
    });

    it('should return correct size for fixed size "bytes"', async function () {
      expect(getStorageSlotSize({ type: 'bytes1' })).toBe(1);
      expect(getStorageSlotSize({ type: 'bytes3' })).toBe(3);
      expect(getStorageSlotSize({ type: 'bytes8' })).toBe(8);
      expect(getStorageSlotSize({ type: 'bytes16' })).toBe(16);
      expect(getStorageSlotSize({ type: 'bytes32' })).toBe(32);
      expect(() => getStorageSlotSize({ type: 'bytes0' })).toThrow('Invalid type "bytes0"');
      expect(() => getStorageSlotSize({ type: 'bytes33' })).toThrow('Invalid type "bytes33"');
    });

    it('should return correct size for dynamic "bytes"', async function () {
      expect(getStorageSlotSize({ type: 'bytes' })).toBe(32);
    });

    it('should return correct size for dynamic "string"', async function () {
      expect(getStorageSlotSize({ type: 'string' })).toBe(32);
    });

    it('should return correct size for dynamic "mapping"', async function () {
      expect(
        getStorageSlotSize({
          type: 'mapping',
          key: { type: 'address' },
          value: { type: 'uint256' },
        })
      ).toBe(32);
    });

    it('should return correct size for dynamic "array"', async function () {
      expect(getStorageSlotSize({ type: 'array', value: { type: 'uint8' } })).toBe(32);
    });

    it('should return correct size for static "array"', async function () {
      expect(getStorageSlotSize({ type: 'array', value: { type: 'uint8' }, length: 5 })).toBe(32);
      expect(getStorageSlotSize({ type: 'array', value: { type: 'uint128' }, length: 3 })).toBe(64);
      expect(
        getStorageSlotSize({
          type: 'array',
          value: { type: 'array', value: { type: 'uint8' }, length: 3 },
          length: 2,
        })
      ).toBe(64);
    });

    it('fails when trying to calculate size for "fixed" & "ufixed"', async function () {
      expect(() => getStorageSlotSize({ type: 'fixed128x18' })).toThrow(
        'Type "fixed128x18" for storage size calculation not implemented'
      );
      expect(() => getStorageSlotSize({ type: 'ufixed128x18' })).toThrow(
        'Type "ufixed128x18" for storage size calculation not implemented'
      );
    });

    it('should return correct size for "struct"', async function () {
      expect(
        getStorageSlotSize({
          type: 'struct',
          members: [{ type: 'uint8' }, { type: 'uint16' }, { type: 'uint32' }, { type: 'uint64' }],
        })
      ).toBe(32); // 1 + 2 + 4 + 8 = 15 rounded to 32

      expect(
        getStorageSlotSize({
          type: 'struct',
          members: [{ type: 'int128' }, { type: 'uint64' }, { type: 'uint64' }],
        })
      ).toBe(32); // 8 + 8 = 16 rounded to 32

      expect(
        getStorageSlotSize({
          type: 'struct',
          members: [{ type: 'uint8' }, { type: 'uint256' }, { type: 'uint8' }],
        })
      ).toBe(96); // 1 (aligned to 32) + 32 + 1 = 65 rounded to 96

      expect(
        getStorageSlotSize({
          type: 'struct',
          members: [
            { type: 'uint8' }, // size 1
            { type: 'struct', members: [{ type: 'uint8' }, { type: 'uint16' }] }, // size 32
            { type: 'uint32' }, // size 4
          ],
        })
      ).toBe(96); // it uses 3 slots because the child struct starts on a new slot
    });
  });
});
