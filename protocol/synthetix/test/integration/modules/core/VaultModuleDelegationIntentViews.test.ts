import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { BigNumber, ethers } from 'ethers';
import hre from 'hardhat';
import { bn, bootstrapWithStakedPool } from '../../bootstrap';
import { declareDelegateIntent } from '../../../common';
import { fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';

describe('VaultModule Two-step Delegation views', function () {
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

  let owner: ethers.Signer, user1: ethers.Signer;

  let MockMarket: ethers.Contract;
  let marketId: BigNumber;

  before('identify signers', async () => {
    [owner, user1] = signers();
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

  before('set initial market window times', async () => {
    await MockMarket.setDelegateCollateralDelay(200);
    await MockMarket.setDelegateCollateralWindow(200);
    await MockMarket.setUndelegateCollateralDelay(200);
    await MockMarket.setUndelegateCollateralWindow(200);
  });

  const intentIds = new Array<BigNumber>();
  let accumulatedDeposit = depositAmount;
  let accummulatedTime = 0;

  before('add timed delegation intents', async () => {
    // add some intents separated by 20 seconds each to test the timed views
    accummulatedTime = await getTime(provider());

    for (let i = 0; i < 5; i++) {
      accumulatedDeposit = accumulatedDeposit.add(depositAmount.div(10));
      accummulatedTime += 20;

      await fastForwardTo(accummulatedTime, provider());
      const intentId = await declareDelegateIntent(
        systems,
        owner,
        user1,
        accountId,
        poolId,
        collateralAddress(),
        accumulatedDeposit,
        ethers.utils.parseEther('1'),
        false
      );

      intentIds.push(intentId);
    }
  });

  const restore = snapshotCheckpoint(provider);

  it('sanity check. It should be 5 intents', async () => {
    assert.equal(intentIds.length, 5);
  });

  describe('Intents Views at initial time (none executable neither expired)', async () => {
    before(restore);

    it('should have all intents', async () => {
      const accountIntentsId = await systems().Core.getAccountIntentIds(accountId);
      assertBn.equal(accountIntentsId.length, 5);
      assert.deepEqual(accountIntentsId, intentIds);
    });

    it('should have no intents as executable', async () => {
      const pendingExecutableIntents = await systems().Core.getAccountExecutableIntentIds(
        accountId,
        100
      );
      assertBn.equal(pendingExecutableIntents.foundItems, 0);
      // 5 is the total of intents, so all are in the array
      assertBn.equal(pendingExecutableIntents.executableIntents.length, 5);
      // all the intents ids are zero, it means none found as expired
      assert.deepEqual(pendingExecutableIntents.executableIntents, [
        bn(0),
        bn(0),
        bn(0),
        bn(0),
        bn(0),
      ]);
    });

    it('should have no intents as expired', async () => {
      const pendingExecutableIntents = await systems().Core.getAccountExpiredIntentIds(
        accountId,
        100
      );
      assertBn.equal(pendingExecutableIntents.foundItems, 0);
      // 5 is the total of intents, so all are in the array
      assertBn.equal(pendingExecutableIntents.expiredIntents.length, 5);
      // all the intents ids are zero, it means none found as expired
      assert.deepEqual(pendingExecutableIntents.expiredIntents, [
        bn(0),
        bn(0),
        bn(0),
        bn(0),
        bn(0),
      ]);
    });
  });

  describe('Intents Views at window opened for all (all executable none expired)', async () => {
    before(restore);

    before('fast forward to mid time', async () => {
      await fastForwardTo(accummulatedTime + 100 + 110, provider());
    });

    it('should have all intents', async () => {
      const accountIntentsId = await systems().Core.getAccountIntentIds(accountId);
      assertBn.equal(accountIntentsId.length, 5);
      assert.deepEqual(accountIntentsId, intentIds);
    });

    it('should have all intents as pending and executable', async () => {
      const pendingExecutableIntents = await systems().Core.getAccountExecutableIntentIds(
        accountId,
        100
      );
      assertBn.equal(pendingExecutableIntents.foundItems, 5);
      assertBn.equal(pendingExecutableIntents.executableIntents.length, 5);
      assert.deepEqual(pendingExecutableIntents.executableIntents, intentIds);
    });

    it('should have no intents as expired', async () => {
      const pendingExecutableIntents = await systems().Core.getAccountExpiredIntentIds(
        accountId,
        100
      );
      assertBn.equal(pendingExecutableIntents.foundItems, 0);
      // 5 is the total of intents, so all are in the array
      assertBn.equal(pendingExecutableIntents.expiredIntents.length, 5);
      // all the intents ids are zero, it means none found as expired
      assert.deepEqual(pendingExecutableIntents.expiredIntents, [
        bn(0),
        bn(0),
        bn(0),
        bn(0),
        bn(0),
      ]);
    });
  });

  describe('Intents Views at mid time (3 expired)', async () => {
    before(restore);

    before('fast forward to mid time', async () => {
      await fastForwardTo(accummulatedTime + 100 + 200 + 70, provider());
    });

    it('should have all intents', async () => {
      const accountIntentsId = await systems().Core.getAccountIntentIds(accountId);
      assertBn.equal(accountIntentsId.length, 5);
      assert.deepEqual(accountIntentsId, intentIds);
    });

    it('should have some as pending and executable', async () => {
      const pendingExecutableIntents = await systems().Core.getAccountExecutableIntentIds(
        accountId,
        100
      );
      assertBn.equal(pendingExecutableIntents.foundItems, 2);
      assertBn.equal(pendingExecutableIntents.executableIntents[0], intentIds[3]);
      assertBn.equal(pendingExecutableIntents.executableIntents[1], intentIds[4]);
    });

    it('should have some intents as expired', async () => {
      const pendingExecutableIntents = await systems().Core.getAccountExpiredIntentIds(
        accountId,
        100
      );
      assertBn.equal(pendingExecutableIntents.foundItems, 3);
      assertBn.equal(pendingExecutableIntents.expiredIntents[0], intentIds[0]);
      assertBn.equal(pendingExecutableIntents.expiredIntents[1], intentIds[1]);
      assertBn.equal(pendingExecutableIntents.expiredIntents[2], intentIds[2]);
    });
  });

  describe('Intents Views at closed window for all (all expired)', async () => {
    before(restore);

    before('fast forward to mid time', async () => {
      await fastForwardTo(accummulatedTime + 100 + 200 + 110, provider());
    });

    it('should have all intents', async () => {
      const accountIntentsId = await systems().Core.getAccountIntentIds(accountId);
      assertBn.equal(accountIntentsId.length, 5);
      assert.deepEqual(accountIntentsId, intentIds);
    });

    it('should have some as pending and executable', async () => {
      const pendingExecutableIntents = await systems().Core.getAccountExecutableIntentIds(
        accountId,
        100
      );
      assertBn.equal(pendingExecutableIntents.foundItems, 0);
      assert.deepEqual(pendingExecutableIntents.executableIntents, [
        bn(0),
        bn(0),
        bn(0),
        bn(0),
        bn(0),
      ]);
    });

    it('should have some intents as expired', async () => {
      const pendingExecutableIntents = await systems().Core.getAccountExpiredIntentIds(
        accountId,
        100
      );
      assertBn.equal(pendingExecutableIntents.foundItems, 5);
      assert.deepEqual(pendingExecutableIntents.expiredIntents, intentIds);
    });
  });
});
