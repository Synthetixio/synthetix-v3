const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');

describe('ArrayUtil', () => {
  let ArrayUtil;

  let user1, user2, user3, user4, user5;

  before('identify signers', async () => {
    [user1, user2, user3, user4, user5] = await ethers.getSigners();
  });

  before('deploy the contract', async () => {
    const factory = await ethers.getContractFactory('ArrayUtilMock');
    ArrayUtil = await factory.deploy();
  });

  it('can detect duplicates', async function () {
    assert.equal(
      await ArrayUtil.hasDuplicates([
        user1.address,
        user2.address,
        user3.address,
        user4.address,
        user5.address,
      ]),
      false
    );

    assert.equal(
      await ArrayUtil.hasDuplicates([
        user1.address,
        user2.address,
        user3.address,
        user3.address,
        user5.address,
      ]),
      true
    );
  });

  describe('when adding multiple values to the array', () => {
    before('add several values to the array', async function () {
      await (await ArrayUtil.addValue(user1.address)).wait();
      await (await ArrayUtil.addValue(user2.address)).wait();
      await (await ArrayUtil.addValue(user3.address)).wait();
      await (await ArrayUtil.addValue(user4.address)).wait();
      await (await ArrayUtil.addValue(user5.address)).wait();
    });

    it('reflects the expected data layout', async function () {
      assertBn.eq(await ArrayUtil.numValues(), 5);

      assertBn.eq(await ArrayUtil.valueAtIndex(0), user1.address);
      assertBn.eq(await ArrayUtil.valueAtIndex(1), user2.address);
      assertBn.eq(await ArrayUtil.valueAtIndex(2), user3.address);
      assertBn.eq(await ArrayUtil.valueAtIndex(3), user4.address);
      assertBn.eq(await ArrayUtil.valueAtIndex(4), user5.address);

      assertBn.eq(await ArrayUtil.positionForValue(user1.address), 1);
      assertBn.eq(await ArrayUtil.positionForValue(user2.address), 2);
      assertBn.eq(await ArrayUtil.positionForValue(user3.address), 3);
      assertBn.eq(await ArrayUtil.positionForValue(user4.address), 4);
      assertBn.eq(await ArrayUtil.positionForValue(user5.address), 5);
    });

    it('reverts when trying to access a value beyond the length of the array', async function () {
      await assertRevert(
        ArrayUtil.valueAtIndex(5),
        'Array accessed at an out-of-bounds or negative index'
      );
    });

    describe('when removing a value', function () {
      before('remove the 3rd value', async function () {
        await (await ArrayUtil.removeValue(user3.address)).wait();
      });

      it('reflects the expected data layout', async function () {
        assertBn.eq(await ArrayUtil.numValues(), 4);

        assertBn.eq(await ArrayUtil.valueAtIndex(0), user1.address);
        assertBn.eq(await ArrayUtil.valueAtIndex(1), user2.address);
        assertBn.eq(await ArrayUtil.valueAtIndex(2), user5.address);
        assertBn.eq(await ArrayUtil.valueAtIndex(3), user4.address);

        assertBn.eq(await ArrayUtil.positionForValue(user1.address), 1);
        assertBn.eq(await ArrayUtil.positionForValue(user2.address), 2);
        assertBn.eq(await ArrayUtil.positionForValue(user3.address), 0);
        assertBn.eq(await ArrayUtil.positionForValue(user5.address), 3);
        assertBn.eq(await ArrayUtil.positionForValue(user4.address), 4);
      });

      describe('when removing another value', function () {
        before('remove the 1st value', async function () {
          await (await ArrayUtil.removeValue(user1.address)).wait();
        });

        it('reflects the expected data layout', async function () {
          assertBn.eq(await ArrayUtil.numValues(), 3);

          assertBn.eq(await ArrayUtil.valueAtIndex(0), user4.address);
          assertBn.eq(await ArrayUtil.valueAtIndex(1), user2.address);
          assertBn.eq(await ArrayUtil.valueAtIndex(2), user5.address);

          assertBn.eq(await ArrayUtil.positionForValue(user1.address), 0);
          assertBn.eq(await ArrayUtil.positionForValue(user4.address), 1);
          assertBn.eq(await ArrayUtil.positionForValue(user2.address), 2);
          assertBn.eq(await ArrayUtil.positionForValue(user3.address), 0);
          assertBn.eq(await ArrayUtil.positionForValue(user5.address), 3);
        });
      });
    });
  });
});
