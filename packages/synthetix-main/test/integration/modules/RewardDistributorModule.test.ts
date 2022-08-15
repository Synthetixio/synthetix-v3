import hre from 'hardhat';
import assert from 'assert/strict';
import assertRevert from '@synthetixio/core-js/dist/utils/assertions/assert-revert';
import { findEvent } from '@synthetixio/core-js/dist/utils/ethers/events';
import { bootstrap } from '../bootstrap';
import assertBn from '@synthetixio/core-js/dist/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';

describe('RewardDistributorModule', function () {
  const { provider, signers, systems } = bootstrap();

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
    const accountId = 1111;
    const fundId = 1234;

    const depositAmount = ethers.utils.parseEther('1000');
    const rewardAmount = ethers.utils.parseEther('10000');

    let collateralAddress: string;

    let aggregator: ethers.Contract;

    before('deploy mock aggregator', async () => {
      const factory = await hre.ethers.getContractFactory('AggregatorV3Mock');
      aggregator = await factory.connect(owner).deploy();

      await aggregator.mockSetCurrentPrice(ethers.utils.parseEther('1'));
    });

    before('set up ', async () => {
      // mint initial snx
      await systems().Core.connect(owner).mintInitialSystemToken(await user1.getAddress(), depositAmount);

      // deploy an aggregator
      collateralAddress = systems().SNX.address;


      // add snx as collateral, 
      await systems().Core.connect(owner).adjustCollateralType(
        collateralAddress, 
        aggregator.address, 
        "5000000000000000000", 
        "1500000000000000000", 
        true
      );

      // create fund
      await systems().Core.connect(owner).createFund(fundId, await owner.getAddress());

      // create user account
      await systems().Core.connect(user1).createAccount(accountId);

      // approve
      await systems().SNX.connect(user1).approve(systems().Core.address, depositAmount);

      // stake collateral
      await systems().Core.connect(user1).stake(accountId, collateralAddress, depositAmount);

      // invest in the fund
      await systems().Core.connect(user1).delegateCollateral(
        accountId,
        fundId,
        collateralAddress,
        depositAmount,
        ethers.utils.parseEther('1')
      );

      // allocate rewards to the fund
      await systems().Core.connect(owner).setRewardAllocation(fundId, rewardAmount);


      // distribute
      await systems().Core.connect(owner).distributeRewards(
        fundId, 
        collateralAddress, 
        0,
        systems().Core.address, // rewards are distributed by the rewards distributor on self 
        rewardAmount.div(2), 
        Math.floor(Date.now() / 1000) - 10, // backdated to distribute reward immediately
        0
      );
    });

    it('reports correct amount of rewards gathered', async () => {
      assertBn.equal((await systems().Core.callStatic.getAvailableRewards(
        fundId,
        collateralAddress,
        accountId
      ))[0], rewardAmount.div(2));
    });

    it('distributes some rewards', async () => {
      await systems().Core.connect(user1).claimRewards(
        fundId,
        collateralAddress,
        accountId
      );

      assertBn.equal(await systems().ESNX.balanceOf(await user1.getAddress()), rewardAmount.div(2));
    });

    describe('re-applied', () => {
      before(async () => {
        await systems().Core.connect(owner).distributeRewards(
          fundId, 
          collateralAddress, 
          0,
          systems().Core.address, // rewards are distributed by the rewards distributor on self 
          rewardAmount, 
          Math.floor(Date.now() / 1000) - 10, // TODO: flakey?
          0
        );
      });

      it('has correct reward amount', async () => {
        assertBn.equal((await systems().Core.callStatic.getAvailableRewards(
          fundId,
          collateralAddress,
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
