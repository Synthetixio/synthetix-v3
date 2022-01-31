const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');

describe('SetUtil', () => {
  const repeater = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  // -----------------------------------------
  // Specific type tests
  // -----------------------------------------

  describe('Bytes32Set', function () {
    const randomBytes32 = () => ethers.Wallet.createRandom().privateKey;

    itSupportsType(
      'Bytes32Set',
      repeater.map(() => randomBytes32()),
      randomBytes32()
    );
  });

  describe('AddressSet', function () {
    const randomAddress = () => ethers.Wallet.createRandom().address;

    itSupportsType(
      'AddressSet',
      repeater.map(() => randomAddress()),
      randomAddress()
    );
  });

  // -----------------------------------------
  // Behaviors
  // -----------------------------------------

  function itSupportsType(typeName, sampleValues, notContainedValue) {
    let SampleSet;

    const expectedValues = [];

    const addValue = async (value) => {
      expectedValues.push(value);

      await SampleSet.add(value);
    };

    const removeValue = async (value) => {
      const index = expectedValues.indexOf(value);

      if (index !== expectedValues.length - 1) {
        const lastValue = expectedValues[expectedValues.length - 1];

        expectedValues[index] = lastValue;
      }

      expectedValues.pop();

      await SampleSet.remove(value);
    };

    const replaceValue = async (value, newValue) => {
      const index = expectedValues.indexOf(value);

      expectedValues[index] = newValue;

      await SampleSet.replace(value, newValue);
    };

    function itBehavesAsAValidSet() {
      it('has the expected length', async function () {
        assertBn.equal(await SampleSet.length(), expectedValues.length);
      });

      it('has the expected values', async function () {
        assert.deepEqual(await SampleSet.values(), expectedValues);
      });

      it('contains all values', async function () {
        for (let value of expectedValues) {
          assert.equal(await SampleSet.contains(value), true);
        }
      });

      it('can retrieve values', async function () {
        for (let index = 0; index < expectedValues.length; index++) {
          const position = index + 1;

          assert.equal(await SampleSet.valueAt(position), expectedValues[index]);
        }
      });

      it('does not contain a value not in the set', async function () {
        assert.equal(await SampleSet.contains(notContainedValue), false);
      });

      it('reverts when trying to access a value not in the set', async function () {
        await assertRevert(SampleSet.valueAt(0), 'PositionOutOfBounds');
        await assertRevert(SampleSet.valueAt(1337), 'PositionOutOfBounds');
      });

      it('reverts when trying to get the position of a value not in the set', async function () {
        await assertRevert(SampleSet.positionOf(notContainedValue), 'ValueNotInSet');
      });

      it('reverts when trying to remove a value not in the set', async function () {
        await assertRevert(SampleSet.remove(notContainedValue), 'ValueNotInSet');
      });

      it('reverts when trying to append a value already exsiting in set', async function () {
        if (expectedValues.length > 0) {
          await assertRevert(SampleSet.add(expectedValues[0]), 'ValueAlreadyInSet');
        }
      });

      it('reverts when trying replace a value in the set with another value in the set', async function () {
        if (expectedValues.length > 1) {
          await assertRevert(
            SampleSet.replace(await SampleSet.valueAt(1), await SampleSet.valueAt(2)),
            'ValueAlreadyInSet'
          );
        }
      });
    }

    before('deploy the contract', async () => {
      const factory = await ethers.getContractFactory(`${typeName}Mock`);
      SampleSet = await factory.deploy();
    });

    describe('before any values are added to the set', function () {
      itBehavesAsAValidSet();
    });

    describe('when some values are added to the set', function () {
      before('add values', async function () {
        await addValue(sampleValues[0]);
        await addValue(sampleValues[1]);
        await addValue(sampleValues[2]);
        await addValue(sampleValues[3]);
      });

      itBehavesAsAValidSet();

      describe('when more values are added to the set', function () {
        before('add values', async function () {
          await addValue(sampleValues[4]);
          await addValue(sampleValues[5]);
        });

        itBehavesAsAValidSet();

        describe('when some values are removed from the set', function () {
          before('remove values', async function () {
            await removeValue(sampleValues[0]);
            await removeValue(sampleValues[1]);
          });

          itBehavesAsAValidSet();
        });

        describe('when more values are added to the set', function () {
          before('add values', async function () {
            await addValue(sampleValues[6]);
            await addValue(sampleValues[7]);
          });

          itBehavesAsAValidSet();

          describe('when some values are removed from the set', function () {
            before('remove values', async function () {
              await removeValue(sampleValues[2]);
              await removeValue(sampleValues[5]);
            });

            itBehavesAsAValidSet();

            describe('when some values are replaced in the set', function () {
              before('replace values', async function () {
                await replaceValue(sampleValues[4], sampleValues[8]);
                await replaceValue(sampleValues[6], sampleValues[9]);
              });

              itBehavesAsAValidSet();
            });
          });
        });
      });
    });
  }
});
