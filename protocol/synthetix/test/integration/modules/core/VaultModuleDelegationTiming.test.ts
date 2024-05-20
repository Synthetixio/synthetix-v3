import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import assert from 'assert/strict';
import { BigNumber, ethers } from 'ethers';
import hre from 'hardhat';
import { bn, bootstrapWithStakedPool } from '../../bootstrap';
import { delegateCollateral, declareDelegateIntent } from '../../../common';
import { fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';

describe('VaultModule Two-step Delegation', function () {
  const {
    signers,
    systems,
    provider,
    accountId,
    poolId,
    depositAmount,
    // collateralContract,
    collateralAddress,
    oracleNodeId,
  } = bootstrapWithStakedPool();

  // const MAX_UINT = ethers.constants.MaxUint256;

  let owner: ethers.Signer, user1: ethers.Signer, user2: ethers.Signer;

  let MockMarket: ethers.Contract;
  let marketId: BigNumber;

  before('identify signers', async () => {
    [owner, user1, user2] = signers();
  });

  before('give user1 permission to register market', async () => {
    await systems()
      .Core.connect(owner)
      .addToFeatureFlagAllowlist(
        ethers.utils.formatBytes32String('registerMarket'),
        await user1.getAddress()
      );
  });

  before('deploy and connect fake market', async () => {
    const factory = await hre.ethers.getContractFactory('MockMarket');

    MockMarket = await factory.connect(owner).deploy();

    marketId = await systems().Core.connect(user1).callStatic.registerMarket(MockMarket.address);

    await systems().Core.connect(user1).registerMarket(MockMarket.address);

    await MockMarket.connect(owner).initialize(
      systems().Core.address,
      marketId,
      ethers.utils.parseEther('1')
    );

    await systems()
      .Core.connect(owner)
      .setPoolConfiguration(poolId, [
        {
          marketId: marketId,
          weightD18: ethers.utils.parseEther('1'),
          maxDebtShareValueD18: ethers.utils.parseEther('10000000000000000'),
        },
      ]);
  });

  before('add second collateral type', async () => {
    // add collateral
    await (
      await systems().Core.connect(owner).configureCollateral({
        tokenAddress: systems().Collateral2Mock.address,
        oracleNodeId: oracleNodeId(),
        issuanceRatioD18: '5000000000000000000',
        liquidationRatioD18: '1500000000000000000',
        liquidationRewardD18: '20000000000000000000',
        minDelegationD18: '20000000000000000000',
        depositingEnabled: true,
      })
    ).wait();

    await systems()
      .Core.connect(owner)
      .configureCollateral({
        tokenAddress: await systems().Core.getUsdToken(),
        oracleNodeId: ethers.utils.formatBytes32String(''),
        issuanceRatioD18: bn(1.5),
        liquidationRatioD18: bn(1.1),
        liquidationRewardD18: 0,
        minDelegationD18: 0,
        depositingEnabled: true,
      });
  });

  const restore = snapshotCheckpoint(provider);

  it('sanity check (to ensure describes happen after the snapshot)', async () => {
    assert(true);
  });

  // Note: Generic Delegation tests uses the default configuration where the delegation window is open immediately and forever.
  // The tests below will test the delegation timing configuration.
  describe('Delegation Timing failures', async () => {
    let intentId: BigNumber;
    let declareDelegateIntentTime: number;
    before('set market window times', async () => {
      await MockMarket.setDelegateCollateralDelay(100);
      await MockMarket.setDelegateCollateralWindow(20);
    });

    before('declare intent to delegate', async () => {
      intentId = await declareDelegateIntent(
        systems,
        owner,
        user1,
        accountId,
        poolId,
        collateralAddress(),
        depositAmount.mul(2),
        ethers.utils.parseEther('1')
      );

      declareDelegateIntentTime = await getTime(provider());
    });

    after(restore);

    it('fails to execute a delegation if window is not open (too soon)', async () => {
      await fastForwardTo(declareDelegateIntentTime + 95, provider());

      await assertRevert(
        systems()
          .Core.connect(user2)
          .processIntentToDelegateCollateralByIntents(accountId, [intentId]),
        `DelegationIntentNotReady("${declareDelegateIntentTime}", "${declareDelegateIntentTime + 100}")`,
        systems().Core
      );
    });

    it('fails to execute a delegation if window is already closed (too late)', async () => {
      await fastForwardTo(declareDelegateIntentTime + 121, provider());

      await assertRevert(
        systems()
          .Core.connect(user2)
          .processIntentToDelegateCollateralByIntents(accountId, [intentId]),
        `DelegationIntentExpired("${declareDelegateIntentTime}", "${declareDelegateIntentTime + 120}")`,
        systems().Core
      );
    });
  });

  describe('Un-Delegation Timing failures', async () => {
    let intentId: BigNumber;
    let declareDelegateIntentTime: number;
    before('set market window times', async () => {
      await MockMarket.setUndelegateCollateralDelay(100);
      await MockMarket.setUndelegateCollateralWindow(20);
    });

    before('first delegete some', async () => {
      // Delegeta something that can be undelegated later
      await delegateCollateral(
        systems,
        owner,
        user1,
        accountId,
        poolId,
        collateralAddress(),
        depositAmount.mul(2),
        ethers.utils.parseEther('1')
      );
    });

    before('declare intent to un-delegate', async () => {
      intentId = await declareDelegateIntent(
        systems,
        owner,
        user1,
        accountId,
        poolId,
        collateralAddress(),
        depositAmount.div(10),
        ethers.utils.parseEther('1')
      );

      declareDelegateIntentTime = await getTime(provider());
    });

    after(restore);

    it('fails to execute an un-delegation if window is not open (too soon)', async () => {
      await fastForwardTo(declareDelegateIntentTime + 95, provider());

      await assertRevert(
        systems()
          .Core.connect(user2)
          .processIntentToDelegateCollateralByIntents(accountId, [intentId]),
        `DelegationIntentNotReady("${declareDelegateIntentTime}", "${declareDelegateIntentTime + 100}")`,
        systems().Core
      );
    });

    it('fails to execute an un-delegation if window is already closed (too late)', async () => {
      await fastForwardTo(declareDelegateIntentTime + 121, provider());

      await assertRevert(
        systems()
          .Core.connect(user2)
          .processIntentToDelegateCollateralByIntents(accountId, [intentId]),
        `DelegationIntentExpired("${declareDelegateIntentTime}", "${declareDelegateIntentTime + 120}")`,
        systems().Core
      );
    });
  });

  describe('Force Delete intents (only system owner)', async () => {
    it('fails to call the functions as non-owner', async () => {});
    it('falis to delete an unexistent intent (wrong id)', async () => {});
    it('can force delete an intent by id', async () => {});
    it('can force delete all expired account intents', async () => {});
  });

  describe('Self Delete intents (only account owner)', async () => {
    it('fails to delete an intent as non-owner', async () => {});
    it("fails to delete an intent that didn't expire", async () => {});
    it('can delete an intent by id', async () => {});
    it('can delete all expired intents', async () => {});
  });

  describe('Edge case - Self delete after configuration change', async () => {
    it("fails to delete an intent that didn't expire (expiration time not set)", async () => {});

    it('after the market config is changed, it can delete the expired intent', async () => {});
  });

  describe('Edge case - Multiple markets with different timing configuration', async () => {
    // note: with 2 markets with different config, will use the longest delay time configuration
    it('fails to execute an intent based on the shortest delay', async () => {});

    it('can execute using the longest delay', async () => {});
  });
});
