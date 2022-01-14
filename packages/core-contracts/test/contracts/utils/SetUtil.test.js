const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');

describe.only('Set', () => {
  let Bytes32Set;

  const SOME_VALUE = '0x000000000000000000000000000000000000000000000000000000000000beef';

  before('deploy the contract', async () => {
    const factory = await ethers.getContractFactory('SetUtilMock');
    Bytes32Set = await factory.deploy();
  });

  describe('before any values are added to the set', function () {
    it('shows that the length is zero', async function () {
      assertBn.eq(await Bytes32Set.length(), 0);
    });

    it('shows that the underlying values are empty', async function () {
      assert.deepEqual(await Bytes32Set.values(), []);
    });

    it('shows that the set does not contain some value', async function () {
      assert.equal(await Bytes32Set.contains(SOME_VALUE), false);
    });

    describe('when trying to access a value not in the set', function () {
      it('reverts', async function () {
        await assertRevert(
          Bytes32Set.valueAt(1337),
          'PositionOutOfBounds'
        );
      });
    });
  });
});
