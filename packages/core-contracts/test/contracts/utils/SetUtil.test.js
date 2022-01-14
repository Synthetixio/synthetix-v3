const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');

describe.only('Set', () => {
  let Bytes32Set;

  const expectedValues = [];

  const SOME_VALUE = '0x000000000000000000000000000000000000000000000000000000000000beef';

  before('deploy the contract', async () => {
    const factory = await ethers.getContractFactory('SetUtilMock');
    Bytes32Set = await factory.deploy();
  });

  const itBehavesAsAValidSet = () => {
    it('has the expected length', async function () {
      assertBn.eq(await Bytes32Set.length(), expectedValues.length);
    });

    it('has the expected values', async function () {
      assert.deepEqual(await Bytes32Set.values(), expectedValues);
    });

    it('contains all values', async function () {
      for (let value of expectedValues) {
        assert.equal(await Bytes32Set.contains(value), true);
      }
    });

    it('can retrieve values', async function () {
      for (let position = 0; position < expectedValues.length; position++) {
        assert.equal(await Bytes32Set.valueAt(position), expectedValues[position]);
      }
    });

    it('does not contain a value not in the set', async function () {
      assert.equal(await Bytes32Set.contains(SOME_VALUE), false);
    });

    it('reverts when trying to access a value not in the set', async function () {
      await assertRevert(Bytes32Set.valueAt(1337), 'PositionOutOfBounds');
    });
  };

  const addValue = async (value) => {
    expectedValues.push(value);

    await Bytes32Set.add(value);
  };

  const removeValue = async (value) => {
    const index = expectedValues.indexOf(value);

    if (index !== expectedValues.length - 1) {
      const lastValue = expectedValues[expectedValues.length - 1];

      expectedValues[index] = lastValue;
    }

    expectedValues.pop();

    await Bytes32Set.remove(value);
  };

  describe('before any values are added to the set', function () {
    itBehavesAsAValidSet();
  });

  describe('when some values are added to the set', function () {
    before('add values', async function () {
      await addValue('0x0000000000000000000000000000000000000000000000000000000deadbeef0');
      await addValue('0x0000000000000000000000000000000000000000000000000000000deadbeef1');
      await addValue('0x0000000000000000000000000000000000000000000000000000000deadbeef2');
      await addValue('0x0000000000000000000000000000000000000000000000000000000deadbeef3');
    });

    itBehavesAsAValidSet();

    describe('when more values are added to the set', function () {
      before('add values', async function () {
        await addValue('0x0000000000000000000000000000000000000000000000000000000deadbeef4');
        await addValue('0x0000000000000000000000000000000000000000000000000000000deadbeef5');
      });

      itBehavesAsAValidSet();

      describe('when some values are removed from the set', function () {
        before('remove values', async function () {
          await removeValue('0x0000000000000000000000000000000000000000000000000000000deadbeef0');
          await removeValue('0x0000000000000000000000000000000000000000000000000000000deadbeef1');
        });

        itBehavesAsAValidSet();
      });

      describe('when more values are added to the set', function () {
        before('add values', async function () {
          await addValue('0x0000000000000000000000000000000000000000000000000000000deadbeef6');
          await addValue('0x0000000000000000000000000000000000000000000000000000000deadbeef7');
        });

        itBehavesAsAValidSet();

        describe('when some values are removed from the set', function () {
          before('remove values', async function () {
            await removeValue('0x0000000000000000000000000000000000000000000000000000000deadbeef2');
            await removeValue('0x0000000000000000000000000000000000000000000000000000000deadbeef5');
          });

          itBehavesAsAValidSet();
        });
      });
    });
  });
});
