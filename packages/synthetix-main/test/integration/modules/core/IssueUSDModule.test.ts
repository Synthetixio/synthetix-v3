import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import hre from 'hardhat';
import { ethers } from 'ethers';
import Permissions from '../../storage/AcccountRBACMixin.permissions';
import { bootstrapWithStakedPool } from '../../bootstrap';
import { snapshotCheckpoint } from '../../../utils';

const MARKET_FEATURE_FLAG = ethers.utils.formatBytes32String('registerMarket');

describe('IssueUSDModule', function () {
  const { signers, systems, provider, accountId, poolId, depositAmount, collateralAddress } =
    bootstrapWithStakedPool();

  let owner: ethers.Signer, user1: ethers.Signer, user2: ethers.Signer;

  let MockMarket: ethers.Contract;
  let marketId: number;

  before('identify signers', async () => {
    [owner, user1, user2] = signers();
  });

  before('deploy and connect fake market', async () => {
    const factory = await hre.ethers.getContractFactory('MockMarket');

    MockMarket = await factory.connect(owner).deploy();

    await systems()
      .Core.connect(owner)
      .addToFeatureFlagAllowlist(MARKET_FEATURE_FLAG, user1.getAddress());

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
        (await systems().Core.getPositionCollateral(accountId, poolId, collateralAddress())).amount,
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
        `PermissionDenied(1, "${Permissions.MINT}", "${await user2.getAddress()}")`,
        systems().Core
      );
    });

    it('verifies sufficient c-ratio', async () => {
      await assertRevert(
        systems()
          .Core.connect(user1)
          .mintUsd(accountId, poolId, collateralAddress(), depositAmount),
        'InsufficientCollateralRatio',
        systems().Core
      );
    });

    describe('successful mint', () => {
      before('mint', async () => {
        await systems().Core.connect(user1).mintUsd(
          accountId,
          poolId,
          collateralAddress(),
          depositAmount.div(10) // should be enough
        );
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

      describe('subsequent mint', () => {
        before('mint again', async () => {
          await systems().Core.connect(user1).mintUsd(
            accountId,
            poolId,
            collateralAddress(),
            depositAmount.div(10) // should be enough
          );
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

  describe('burnUSD()', async () => {
    before(restore);
    before('mint', async () => {
      await systems()
        .Core.connect(user1)
        .mintUsd(accountId, poolId, collateralAddress(), depositAmount.div(10));
    });

    describe('burn from other account', async () => {
      before('transfer burn collateral', async () => {
        // send the collateral to account 2 so it can burn on behalf
        await systems()
          .USD.connect(user1)
          .transfer(await user2.getAddress(), depositAmount.div(10));
      });

      before('other account burn', async () => {
        await systems()
          .Core.connect(user2)
          .burnUsd(accountId, poolId, collateralAddress(), depositAmount.div(10));
      });

      it('has correct debt', verifyAccountState(accountId, poolId, depositAmount, 0));

      it('took away from user2', async () => {
        assertBn.equal(await systems().USD.balanceOf(await user2.getAddress()), 0);
      });
    });
  });
});
