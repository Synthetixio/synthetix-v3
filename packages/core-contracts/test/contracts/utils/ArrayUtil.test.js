const { ethers } = hre;
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');

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
