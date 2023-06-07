/* eslint-disable @typescript-eslint/ban-ts-comment */

import assert from 'node:assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { BigNumberish } from 'ethers';
import hre from 'hardhat';
import { AddressSetMock, Bytes32SetMock, UintSetMock } from '../../../typechain-types';

type SetType = 'Bytes32Set' | 'AddressSet' | 'UintSet';

interface SetContractMap {
  Bytes32Set: Bytes32SetMock;
  AddressSet: AddressSetMock;
  UintSet: UintSetMock;
}

interface SetValueMap {
  Bytes32Set: string;
  AddressSet: string;
  UintSet: BigNumberish;
}

describe('SetUtil', function () {
  const repeater = Array.from(Array(10));

  // -----------------------------------------
  // Specific type tests
  // -----------------------------------------

  describe('Bytes32Set', function () {
    const randomBytes32 = () => hre.ethers.Wallet.createRandom().privateKey;

    itSupportsType(
      'Bytes32Set',
      repeater.map(() => randomBytes32()),
      randomBytes32()
    );
  });

  describe('AddressSet', function () {
    const randomAddress = () => hre.ethers.Wallet.createRandom().address;

    itSupportsType(
      'AddressSet',
      repeater.map(() => randomAddress()),
      randomAddress()
    );
  });

  describe('UintSet', function () {
    const randomUint = () =>
      hre.ethers.utils.parseEther(`${Math.floor(1000000000 * Math.random())}`);

    itSupportsType(
      'UintSet',
      repeater.map(() => randomUint()),
      randomUint()
    );
  });

  // -----------------------------------------
  // Behaviors
  // -----------------------------------------

  function itSupportsType<T extends SetType, V extends SetValueMap[T]>(
    typeName: T,
    sampleValues: V[],
    notContainedValue: V
  ) {
    let SampleSet: SetContractMap[T];

    const expectedValues: V[] = [];
    const replacedValues: V[] = [];

    const addValue = async (value: V) => {
      expectedValues.push(value);
      //@ts-ignore
      await SampleSet.add(value);
    };

    const removeValue = async (value: V) => {
      const index = expectedValues.indexOf(value);

      if (index !== expectedValues.length - 1) {
        const lastValue = expectedValues[expectedValues.length - 1];

        expectedValues[index] = lastValue;
      }

      expectedValues.pop();
      //@ts-ignore
      await SampleSet.remove(value);
    };

    const replaceValue = async (value: V, newValue: V) => {
      replacedValues.push(value);

      const index = expectedValues.indexOf(value);

      expectedValues[index] = newValue;

      await SampleSet.replace(value as string, newValue as string);
    };

    function itBehavesAsAValidSet() {
      it('has the expected length', async function () {
        assertBn.equal(await SampleSet.length(), expectedValues.length);
      });

      it('has the expected values', async function () {
        assert.deepEqual(await SampleSet.values(), expectedValues);
      });

      it('contains all values', async function () {
        for (const value of expectedValues) {
          //@ts-ignore
          assert.equal(await SampleSet.contains(value), true);
        }
      });

      it('does not contain replaced values', async function () {
        for (const value of replacedValues) {
          //@ts-ignore
          assert.equal(await SampleSet.contains(value), false);
        }
      });

      it('can retrieve values', async function () {
        for (let index = 0; index < expectedValues.length; index++) {
          const position = index + 1;

          assert.deepEqual(await SampleSet.valueAt(position), expectedValues[index]);
        }
      });

      it('does not contain a value not in the set', async function () {
        //@ts-ignore
        assert.equal(await SampleSet.contains(notContainedValue), false);
      });

      it('reverts when trying to access a value not in the set', async function () {
        await assertRevert(SampleSet.valueAt(0), 'PositionOutOfBounds', SampleSet);
        await assertRevert(SampleSet.valueAt(1337), 'PositionOutOfBounds', SampleSet);
      });

      it('reverts when trying to get the position of a value not in the set', async function () {
        //@ts-ignore
        await assertRevert(SampleSet.positionOf(notContainedValue), 'ValueNotInSet', SampleSet);
      });

      it('reverts when trying to remove a value not in the set', async function () {
        //@ts-ignore
        await assertRevert(SampleSet.remove(notContainedValue), 'ValueNotInSet', SampleSet);
      });

      it('reverts when trying to append a value already existing in set', async function () {
        if (expectedValues.length > 0) {
          //@ts-ignore
          await assertRevert(SampleSet.add(expectedValues[0]), 'ValueAlreadyInSet', SampleSet);
        }
      });

      it('reverts when trying replace a value in the set with another value in the set', async function () {
        if (expectedValues.length > 1) {
          await assertRevert(
            //@ts-ignore
            SampleSet.replace(await SampleSet.valueAt(1), await SampleSet.valueAt(2)),
            'ValueAlreadyInSet',
            SampleSet
          );
        }
      });
    }

    before('deploy the contract', async function () {
      const factory = await hre.ethers.getContractFactory(`${typeName}Mock`);
      SampleSet = (await factory.deploy()) as SetContractMap[T];
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
