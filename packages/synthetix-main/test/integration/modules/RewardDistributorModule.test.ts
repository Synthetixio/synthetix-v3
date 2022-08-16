import assertRevert from '@synthetixio/core-js/dist/utils/assertions/assert-revert';
import { bootstrap, bootstrapWithStakedFund } from '../bootstrap';
import assertBn from '@synthetixio/core-js/dist/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';

describe('RewardDistributorModule', function () {
  const { 
    signers, 
    systems,
    accountId,
    fundId,
    depositAmount,
    aggregator,
    collateralAddress
  } = bootstrapWithStakedFund();

  let owner: ethers.Signer, user1: ethers.Signer;

  before('identify signers', async () => {
    [owner, user1] = signers();
  });

  describe('setRewardAllocation()', async () => {
    it('is only owner', async () => {
      assertRevert(
        systems().Core.connect(user1).setRewardAllocation(1234, 100000000),
        `Unauthorized("${await user1.getAddress()}")`,
        systems().Core
      )
    });

    it('sets reward allocation', async () => {
      await systems().Core.connect(owner).setRewardAllocation(1234, 100000000);
      assertBn.equal(await systems().Core.getRewardAllocation(1234), 100000000);
      await systems().Core.connect(owner).setRewardAllocation(1234, 234234);
      assertBn.equal(await systems().Core.getRewardAllocation(1234), 234234);
    });
  });


  describe('payout()', () => {
    const rewardAmount = ethers.utils.parseEther('10000');

    before('set up', async () => {
      // allocate rewards to the fund
      await systems().Core.connect(owner).setRewardAllocation(fundId, rewardAmount);

      // distribute
      await systems().Core.connect(owner).distributeRewards(
        fundId, 
        collateralAddress(), 
        0,
        systems().Core.address, // rewards are distributed by the rewards distributor on self 
        rewardAmount.div(2), 
        0, // backdated to distribute reward immediately
        0
      );
    });

    it('reports correct amount of rewards gathered', async () => {
      assertBn.equal((await systems().Core.callStatic.getAvailableRewards(
        fundId,
        collateralAddress(),
        accountId
      ))[0], rewardAmount.div(2));
    });

    it('distributes some rewards', async () => {
      await systems().Core.connect(user1).claimRewards(
        fundId,
        collateralAddress(),
        accountId
      );

      assertBn.equal(await systems().ESNX.balanceOf(await user1.getAddress()), rewardAmount.div(2));
    });

    describe('re-applied', () => {
      before(async () => {
        await systems().Core.connect(owner).distributeRewards(
          fundId, 
          collateralAddress(), 
          0,
          systems().Core.address, // rewards are distributed by the rewards distributor on self 
          rewardAmount, 
          0, // TODO: flakey?
          0
        );
      });

      it('has correct reward amount', async () => {
        assertBn.equal((await systems().Core.callStatic.getAvailableRewards(
          fundId,
          collateralAddress(),
          accountId
        ))[0], rewardAmount);
      });

      it('does not distribute rewards if allocation is exceeded', async () => {
  
        assertRevert(systems().Core.connect(user1).claimRewards(
            fundId,
            systems().SNX.address,
            accountId
          ),
          "Unauthorized",
          systems().Core
        );
      });
  
      it('distributes rewards if allocation is re-applied', async () => {
        await systems().Core.connect(owner).setRewardAllocation(fundId, rewardAmount);
  
        // test from earlier already distributed rewards so we can just retry same txn from earlier
        await systems().Core.connect(user1).claimRewards(
          fundId,
          systems().SNX.address,
          accountId
        );
  
        assertBn.equal(await systems().ESNX.balanceOf(await user1.getAddress()), rewardAmount.add(rewardAmount.div(2)));
      });
    });
  });


});
