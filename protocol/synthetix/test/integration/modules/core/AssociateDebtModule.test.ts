import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';

import { bootstrapWithMockMarketAndPool } from '../../bootstrap';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';

describe('AssociateDebtModule', function () {
  const {
    signers,
    systems,
    collateralAddress,
    collateralContract,
    poolId,
    accountId,
    MockMarket,
    marketId,
    depositAmount,
    provider,
  } = bootstrapWithMockMarketAndPool();

  let owner: ethers.Signer;
  let user1: ethers.Signer, user2: ethers.Signer;

  before('identify signers', async () => {
    [owner, user1, user2] = signers();
  });

  before('clear feature flags', async function () {
    await systems()
      .Core.connect(owner)
      .setFeatureFlagAllowAll(ethers.utils.formatBytes32String('associateDebt'), true);
  });

  describe('associateDebt()', () => {
    const restore = snapshotCheckpoint(provider);

    const amount = ethers.utils.parseEther('100');

    it('only works from the configured market address', async () => {
      await assertRevert(
        systems()
          .Core.connect(user2)
          .associateDebt(marketId(), poolId, collateralAddress(), accountId, amount),
        `Unauthorized("${await user2.getAddress()}")`,
        systems().Core
      );
    });

    it('only works when the market is actually included in the pool', async () => {
      await assertRevert(
        MockMarket()
          .connect(user2)
          .callAssociateDebt(828374, collateralAddress(), accountId, amount),
        `NotFundedByPool("${marketId()}", "828374")`,
        systems().Core
      );
    });

    it('only works when the account exists', async () => {
      await assertRevert(
        MockMarket()
          .connect(user2)
          .callAssociateDebt(marketId(), collateralAddress(), 327823912, amount),
        'AccountNotFound("327823912")',
        systems().Core
      );
    });

    it('only works when the target account has enough collateral', async () => {
      const debt = depositAmount.div(3).mul(2).add(100);
      await MockMarket().connect(owner).setReportedDebt(debt);
      const { liquidationRatioD18 } =
        await systems().Core.getCollateralConfiguration(collateralAddress());
      const price = await systems().Core.getCollateralPrice(collateralAddress());

      await assertRevert(
        MockMarket().connect(user2).callAssociateDebt(poolId, collateralAddress(), accountId, debt),
        `InsufficientCollateralRatio("${depositAmount}", "${debt}", "${depositAmount
          .mul(price)
          .div(debt)}", "${liquidationRatioD18}")`,
        systems().Core
      );
    });

    describe('assigning debt to self', async () => {
      after(restore);
      it('works when assigning max amount of debt - 1', async () => {
        // sit just below the liqudiation limit
        const debt = depositAmount.div(3).mul(2);
        await MockMarket().connect(owner).setReportedDebt(debt);

        // should be able to associate
        await (
          await MockMarket()
            .connect(user2)
            .callAssociateDebt(poolId, collateralAddress(), accountId, debt)
        ).wait();
      });
    });

    describe('with a second staker', async () => {
      const user2AccountId = 28374737562;

      // TODO: refactor this `before` into its own helper function, its so common
      before('new staker', async () => {
        // user1 has extra collateral available
        await collateralContract()
          .connect(user1)
          .transfer(await user2.getAddress(), depositAmount.mul(2));

        await systems().Core.connect(user2)['createAccount(uint128)'](user2AccountId);

        await collateralContract()
          .connect(user2)
          .approve(systems().Core.address, depositAmount.mul(2));

        await systems()
          .Core.connect(user2)
          .deposit(user2AccountId, collateralAddress(), depositAmount.mul(2));

        await systems().Core.connect(user2).delegateCollateral(
          user2AccountId,
          poolId,
          collateralAddress(),
          depositAmount, // user1 50%, user2 50%
          ethers.utils.parseEther('1')
        );
      });

      describe('when the market reported debt is 100', function () {
        before('set reported debt to 100', async function () {
          await MockMarket().connect(owner).setReportedDebt(amount);
        });

        it('shows users have expected debt', async function () {
          assertBn.equal(
            await systems().Core.callStatic.getPositionDebt(accountId, poolId, collateralAddress()),
            ethers.utils.parseEther('50')
          );
          assertBn.equal(
            await systems().Core.callStatic.getPositionDebt(
              user2AccountId,
              poolId,
              collateralAddress()
            ),
            ethers.utils.parseEther('50')
          );
        });

        describe('when the market reported debt is 200', function () {
          before('set reported debt to 200', async function () {
            await MockMarket().connect(owner).setReportedDebt(amount.mul(2));
          });

          it('shows users have expected debt', async function () {
            assertBn.equal(
              await systems().Core.callStatic.getPositionDebt(
                accountId,
                poolId,
                collateralAddress()
              ),
              ethers.utils.parseEther('100')
            );
            assertBn.equal(
              await systems().Core.callStatic.getPositionDebt(
                user2AccountId,
                poolId,
                collateralAddress()
              ),
              ethers.utils.parseEther('100')
            );
          });

          it('edge case: only works when the market is *in range* in the pool', async () => {
            await MockMarket().connect(owner).setReportedDebt(amount.mul(10000000000));

            await assertRevert(
              MockMarket()
                .connect(user2)
                .callAssociateDebt(poolId, collateralAddress(), accountId, amount),
              `NotFundedByPool("${marketId()}", "1")`,
              systems().Core
            );

            await MockMarket().connect(owner).setReportedDebt(amount.mul(2));
          });

          describe('when associateDebt is invoked', async () => {
            before('invoke', async () => {
              await MockMarket()
                .connect(user2)
                .callAssociateDebt(poolId, collateralAddress(), accountId, amount);
            });

            it('increases the debt of the user whose debt was associated', async () => {
              assertBn.equal(
                await systems().Core.callStatic.getPositionDebt(
                  accountId,
                  poolId,
                  collateralAddress()
                ),
                ethers.utils.parseEther('150')
              );
            });

            it('keeps other user debt the same', async () => {
              assertBn.equal(
                await systems().Core.callStatic.getPositionDebt(
                  user2AccountId,
                  poolId,
                  collateralAddress()
                ),
                ethers.utils.parseEther('50')
              );
            });
          });
        });
      });
    });
  });
});
