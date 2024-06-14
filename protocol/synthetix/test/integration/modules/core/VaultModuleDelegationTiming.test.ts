import assert from 'assert/strict';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
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
    collateralAddress,
    oracleNodeId,
  } = bootstrapWithStakedPool();

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
      const previousConfiguration = await MockMarket.getDelegationCollateralConfiguration();
      await MockMarket.setDelegationCollateralConfiguration(
        100,
        20,
        previousConfiguration[2],
        previousConfiguration[3]
      );
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
        `DelegationIntentNotReady`,
        systems().Core
      );
    });

    it('fails to execute a delegation if window is already closed (too late)', async () => {
      await fastForwardTo(declareDelegateIntentTime + 121, provider());

      await assertRevert(
        systems()
          .Core.connect(user2)
          .processIntentToDelegateCollateralByIntents(accountId, [intentId]),
        `DelegationIntentExpired`,
        systems().Core
      );
    });
  });

  describe('Un-Delegation Timing failures', async () => {
    let intentId: BigNumber;
    let declareDelegateIntentTime: number;
    before('set market window times', async () => {
      const previousConfiguration = await MockMarket.getDelegationCollateralConfiguration();
      await MockMarket.setDelegationCollateralConfiguration(
        previousConfiguration[0],
        previousConfiguration[1],
        100,
        20
      );
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
        `DelegationIntentNotReady`,
        systems().Core
      );
    });

    it('fails to execute an un-delegation if window is already closed (too late)', async () => {
      await fastForwardTo(declareDelegateIntentTime + 121, provider());

      await assertRevert(
        systems()
          .Core.connect(user2)
          .processIntentToDelegateCollateralByIntents(accountId, [intentId]),
        `DelegationIntentExpired`,
        systems().Core
      );
    });
  });

  describe('Force Delete intents (only system owner)', async () => {
    let intentId: BigNumber;
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
    });

    const restoreToDeclare = snapshotCheckpoint(provider);

    it('fails to call the functions as non-owner', async () => {
      await assertRevert(
        systems().Core.connect(user1).forceDeleteAllAccountIntents(accountId),
        `Unauthorized("${await user1.getAddress()}")`,
        systems().Core
      );
    });

    it('fails to call the functions as non-owner', async () => {
      await assertRevert(
        systems().Core.connect(user1).forceDeleteIntents(accountId, [intentId]),
        `Unauthorized("${await user1.getAddress()}")`,
        systems().Core
      );
    });

    describe('Force Delete intents by ID', async () => {
      before(restoreToDeclare);
      it('sanity check. The intent exists', async () => {
        const intent = await systems().Core.connect(owner).getAccountIntent(accountId, intentId);
        assertBn.equal(intent[0], accountId);
      });

      it('can force delete an intent by id', async () => {
        await systems().Core.connect(owner).forceDeleteIntents(accountId, [intentId]);
      });

      it('intent is deleted', async () => {
        await assertRevert(
          systems().Core.connect(owner).getAccountIntent(accountId, intentId),
          'InvalidDelegationIntent()',
          systems().Core
        );
      });
    });

    describe('Force Delete intents by Account', async () => {
      before(restoreToDeclare);
      it('sanity check. The intent exists', async () => {
        const intent = await systems().Core.connect(owner).getAccountIntent(accountId, intentId);
        assertBn.equal(intent[0], accountId);
      });

      it('can force delete all expired account intents', async () => {
        await systems().Core.connect(owner).forceDeleteAllAccountIntents(accountId);
      });

      it('intent is deleted', async () => {
        await assertRevert(
          systems().Core.connect(owner).getAccountIntent(accountId, intentId),
          'InvalidDelegationIntent()',
          systems().Core
        );
      });
    });
  });

  describe('Self Delete intents (only account owner)', async () => {
    let intentId: BigNumber;
    let declareDelegateIntentTime: number;
    before('set market window times', async () => {
      const previousConfiguration = await MockMarket.getDelegationCollateralConfiguration();
      await MockMarket.setDelegationCollateralConfiguration(
        100,
        20,
        previousConfiguration[2],
        previousConfiguration[3]
      );
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

    const restoreToDeclare = snapshotCheckpoint(provider);

    it("fails to delete an intent that didn't expire", async () => {
      await fastForwardTo(declareDelegateIntentTime + 115, provider());
      await assertRevert(
        systems().Core.connect(user1).deleteExpiredIntents(accountId, [intentId]),
        `DelegationIntentNotExpired`,
        systems().Core
      );
    });

    describe('can delete an intent by id (as another user)', async () => {
      before(restoreToDeclare);

      it('sanity check. The intent exists', async () => {
        const intent = await systems().Core.connect(user2).getAccountIntent(accountId, intentId);
        assertBn.equal(intent[0], accountId);
      });

      it('can delete an expired intent', async () => {
        await fastForwardTo(declareDelegateIntentTime + 121, provider());
        await systems().Core.connect(user2).deleteExpiredIntents(accountId, [intentId]);
      });

      it('intent is deleted', async () => {
        await assertRevert(
          systems().Core.connect(user2).getAccountIntent(accountId, intentId),
          'InvalidDelegationIntent()',
          systems().Core
        );
      });
    });

    describe('can delete all expired intents', async () => {
      before(restoreToDeclare);

      it('sanity check. The intent exists', async () => {
        const intent = await systems().Core.connect(user2).getAccountIntent(accountId, intentId);
        assertBn.equal(intent[0], accountId);
      });

      it('can delete all account expired intents', async () => {
        await fastForwardTo(declareDelegateIntentTime + 121, provider());
        await systems().Core.connect(user2).deleteAllExpiredIntents(accountId);
      });

      it('intent is deleted', async () => {
        await assertRevert(
          systems().Core.connect(user2).getAccountIntent(accountId, intentId),
          'InvalidDelegationIntent()',
          systems().Core
        );
      });
    });
  });

  describe('Edge case - Self delete after configuration change', async () => {
    let intentId: BigNumber;
    let declareDelegateIntentTime: number;
    before('set market window times', async () => {
      const previousConfiguration = await MockMarket.getDelegationCollateralConfiguration();
      await MockMarket.setDelegationCollateralConfiguration(
        10000,
        2000,
        previousConfiguration[2],
        previousConfiguration[3]
      );
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

    before('set market window times', async () => {
      const previousConfiguration = await MockMarket.getDelegationCollateralConfiguration();
      await MockMarket.setDelegationCollateralConfiguration(
        100,
        20,
        previousConfiguration[2],
        previousConfiguration[3]
      );
    });

    it('sanity check. The intent exists', async () => {
      const intent = await systems().Core.connect(user1).getAccountIntent(accountId, intentId);
      assertBn.equal(intent[0], accountId);
    });

    it('can force delete all expired account intents', async () => {
      await fastForwardTo(declareDelegateIntentTime + 121, provider());
      await systems().Core.connect(user1).deleteAllExpiredIntents(accountId);
    });

    it('intent is deleted', async () => {
      await assertRevert(
        systems().Core.connect(user1).getAccountIntent(accountId, intentId),
        'InvalidDelegationIntent()',
        systems().Core
      );
    });
  });

  describe('Edge case - Self delete non configured (default expiration is after delay)', async () => {
    let intentId: BigNumber;
    let declareDelegateIntentTime: number;
    before(restore);
    before('set market window times', async () => {
      const previousConfiguration = await MockMarket.getDelegationCollateralConfiguration();
      await MockMarket.setDelegationCollateralConfiguration(
        150,
        0,
        previousConfiguration[2],
        previousConfiguration[3]
      );
      // Note: not setting the window size to zero - forever expiration to execute, immediate expiration to delete
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

    it('sanity check 1. The intent exists', async () => {
      const intent = await systems().Core.connect(user1).getAccountIntent(accountId, intentId);
      assertBn.equal(intent[0], accountId);
    });

    it('fails to delete before window starts', async () => {
      await fastForwardTo(declareDelegateIntentTime + 145, provider());
      await systems().Core.connect(user1).deleteAllExpiredIntents(accountId);
    });

    it('sanity check 2. The intent exists', async () => {
      const intent = await systems().Core.connect(user1).getAccountIntent(accountId, intentId);
      assertBn.equal(intent[0], accountId);
    });

    it('can force delete all expired account intents', async () => {
      await fastForwardTo(declareDelegateIntentTime + 155, provider());
      await systems().Core.connect(user1).deleteAllExpiredIntents(accountId);
    });

    it('intent is deleted', async () => {
      await assertRevert(
        systems().Core.connect(user1).getAccountIntent(accountId, intentId),
        'InvalidDelegationIntent()',
        systems().Core
      );
    });
  });

  describe('Edge case - Multiple markets with different timing configuration', async () => {
    // note: with 2 markets with different config, will use the longest delay time configuration

    let SecondMockMarket: ethers.Contract;
    let secondMarketId: BigNumber;
    let intentId: BigNumber;
    let declareDelegateIntentTime: number;

    before('deploy and connect a second fake market', async () => {
      const factory = await hre.ethers.getContractFactory('MockMarket');

      SecondMockMarket = await factory.connect(owner).deploy();

      secondMarketId = await systems()
        .Core.connect(user1)
        .callStatic.registerMarket(SecondMockMarket.address);

      await systems().Core.connect(user1).registerMarket(SecondMockMarket.address);

      await SecondMockMarket.connect(owner).initialize(
        systems().Core.address,
        secondMarketId,
        ethers.utils.parseEther('1')
      );

      await systems()
        .Core.connect(owner)
        .setPoolConfiguration(poolId, [
          {
            marketId: secondMarketId,
            weightD18: ethers.utils.parseEther('1'),
            maxDebtShareValueD18: ethers.utils.parseEther('10000000000000000'),
          },
        ]);
    });

    before('set both market window times', async () => {
      await MockMarket.setDelegationCollateralConfiguration(100, 0, 100, 0);

      await SecondMockMarket.setDelegationCollateralConfiguration(200, 20, 200, 20);
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

    it('intent is skipped to execute an intent based on the shortest delay', async () => {
      await fastForwardTo(declareDelegateIntentTime + 120, provider());

      const tx = await systems()
        .Core.connect(user2)
        .processIntentToDelegateCollateralByIntents(accountId, [intentId]);

      await assertEvent(
        tx,
        `DelegationIntentSkipped(${intentId}, ${accountId}, ${poolId}, "${collateralAddress()}")`,
        systems().Core
      );
    });

    it('can execute using the longest delay', async () => {
      await fastForwardTo(declareDelegateIntentTime + 210, provider());

      await systems()
        .Core.connect(user2)
        .processIntentToDelegateCollateralByIntents(accountId, [intentId]);
    });

    it('intent is removed (skipped) to execute an intent based on the wrong window', async () => {
      const newIntentId = await declareDelegateIntent(
        systems,
        owner,
        user1,
        accountId,
        poolId,
        collateralAddress(),
        depositAmount.mul(1),
        ethers.utils.parseEther('1')
      );

      const newDeclareDelegateIntentTime = await getTime(provider());

      await fastForwardTo(newDeclareDelegateIntentTime + 250, provider());

      const tx = await systems()
        .Core.connect(user2)
        .processIntentToDelegateCollateralByIntents(accountId, [newIntentId]);

      await assertEvent(
        tx,
        `DelegationIntentSkipped(${newIntentId}, ${accountId}, ${poolId}, "${collateralAddress()}")`,
        systems().Core
      );

      await assertEvent(
        tx,
        `DelegationIntentRemoved(${newIntentId}, ${accountId}, ${poolId}, "${collateralAddress()}")`,
        systems().Core
      );
    });
  });
});
