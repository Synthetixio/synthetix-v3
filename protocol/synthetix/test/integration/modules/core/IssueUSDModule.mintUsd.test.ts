import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { BigNumber, ethers } from 'ethers';
import hre from 'hardhat';
import { bn, bootstrapWithStakedPool } from '../../bootstrap';
import Permissions from '../../mixins/AccountRBACMixin.permissions';
import { verifyUsesFeatureFlag } from '../../verifications';

const MARKET_FEATURE_FLAG = ethers.utils.formatBytes32String('registerMarket');

describe('IssueUSDModule', function () {
  const { signers, systems, provider, accountId, poolId, depositAmount, collateralAddress } =
    bootstrapWithStakedPool();

  let owner: ethers.Signer, user1: ethers.Signer, user2: ethers.Signer;

  let MockMarket: ethers.Contract;
  let marketId: BigNumber;

  before('identify signers', async () => {
    [owner, user1, user2] = signers();
  });

  before('deploy and connect fake market', async () => {
    const factory = await hre.ethers.getContractFactory('MockMarket');

    MockMarket = await factory.connect(owner).deploy();

    await systems()
      .Core.connect(owner)
      .addToFeatureFlagAllowlist(MARKET_FEATURE_FLAG, await user1.getAddress());

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

    await systems()
      .Core.connect(owner)
      .configureCollateral({
        tokenAddress: await systems().Core.getUsdToken(),
        oracleNodeId: ethers.utils.formatBytes32String(''),
        issuanceRatioD18: bn(150),
        liquidationRatioD18: bn(100),
        liquidationRewardD18: 0,
        minDelegationD18: 0,
        depositingEnabled: true,
      });
  });

  const restore = snapshotCheckpoint(provider);

  // eslint-disable-next-line max-params
  function verifyAccountState(
    accountId: number,
    poolId: number,
    collateralAmount: ethers.BigNumberish,
    debt: ethers.BigNumberish
  ) {
    return async () => {
      assertBn.equal(
        await systems().Core.getPositionCollateral(accountId, poolId, collateralAddress()),
        collateralAmount
      );
      assertBn.equal(
        await systems().Core.callStatic.getPositionDebt(accountId, poolId, collateralAddress()),
        debt
      );
    };
  }

  describe('mintUsd()', async () => {
    before(restore);
    it('verifies permission for account', async () => {
      await assertRevert(
        systems()
          .Core.connect(user2)
          .mintUsd(accountId, poolId, collateralAddress(), depositAmount.mul(10)),
        `PermissionDenied("1", "${Permissions.MINT}", "${await user2.getAddress()}")`,
        systems().Core
      );
    });

    it('verifies sufficient c-ratio', async () => {
      const { issuanceRatioD18 } =
        await systems().Core.getCollateralConfiguration(collateralAddress());
      const price = await systems().Core.getCollateralPrice(collateralAddress());

      await assertRevert(
        systems()
          .Core.connect(user1)
          .mintUsd(accountId, poolId, collateralAddress(), depositAmount),
        `InsufficientCollateralRatio("${depositAmount}", "${depositAmount}", "${price}", "${issuanceRatioD18}")`,
        systems().Core
      );
    });

    it('verifies pool exists', async () => {
      await assertRevert(
        systems().Core.connect(user1).mintUsd(
          accountId,
          845628, // invalid pool id
          collateralAddress(),
          depositAmount.div(10) // should be enough
        ),
        'PoolNotFound("845628")',
        systems().Core
      );
    });

    it('verifies that deposit is disabled when collateral is disabled', async () => {
      const snapshotId = await provider().send('evm_snapshot', []);

      // disable collateral
      await systems()
        .Core.connect(owner)
        .configureCollateral({
          depositingEnabled: false,
          issuanceRatioD18: bn(2),
          liquidationRatioD18: bn(2),
          liquidationRewardD18: 0,
          oracleNodeId: ethers.utils.formatBytes32String(''),
          tokenAddress: collateralAddress(),
          minDelegationD18: 0,
        });

      const txn = systems().Core.connect(user1).mintUsd(
        accountId,
        poolId,
        collateralAddress(),
        depositAmount.div(10) // should be enough
      );

      await assertRevert(txn, 'CollateralDepositDisabled', systems().Core.connect(owner));

      await provider().send('evm_revert', [snapshotId]);
    });

    verifyUsesFeatureFlag(
      () => systems().Core,
      'mintUsd',
      () =>
        systems()
          .Core.connect(user1)
          .mintUsd(accountId, poolId, collateralAddress(), depositAmount.div(10))
    );

    describe('successful mint', () => {
      before('mint', async () => {
        await systems().Core.connect(user1).mintUsd(
          accountId,
          poolId,
          collateralAddress(),
          depositAmount.div(10) // should be enough
        );
        await systems()
          .Core.connect(user1)
          .withdraw(accountId, await systems().Core.getUsdToken(), depositAmount.div(10));
      });

      it(
        'has correct debt',
        verifyAccountState(accountId, poolId, depositAmount, depositAmount.div(10))
      );

      it('sent USD to user1', async () => {
        assertBn.equal(
          await systems().USD.balanceOf(await user1.getAddress()),
          depositAmount.div(10)
        );
      });

      it('decreased available capacity for market', async () => {
        assertBn.equal(
          await systems().Core.getWithdrawableMarketUsd(marketId),
          depositAmount.sub(depositAmount.div(10))
        );
      });

      describe('subsequent mint', () => {
        before('mint again', async () => {
          await systems().Core.connect(user1).mintUsd(
            accountId,
            poolId,
            collateralAddress(),
            depositAmount.div(10) // should be enough
          );

          await systems()
            .Core.connect(user1)
            .withdraw(accountId, await systems().Core.getUsdToken(), depositAmount.div(10));
        });

        it(
          'has correct debt',
          verifyAccountState(accountId, poolId, depositAmount, depositAmount.div(5))
        );

        it('sent more USD to user1', async () => {
          assertBn.equal(
            await systems().USD.balanceOf(await user1.getAddress()),
            depositAmount.div(5)
          );
        });
      });
    });
  });
});
