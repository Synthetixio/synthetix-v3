import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';

import { bootstrapWithMockMarketAndPool } from '../../bootstrap';
import { verifyUsesFeatureFlag } from '../../verifications';

describe('LiquidationModule', function () {
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
    restore,
  } = bootstrapWithMockMarketAndPool();

  let user1: ethers.Signer, user2: ethers.Signer;

  before('identify signers', async () => {
    [, user1, user2] = signers();
  });

  describe('liquidate()', () => {
    before(restore);
    const liquidatorAccountId = 384572397362836;

    before('create liquidator account', async () => {
      await systems().Core.connect(user2)['createAccount(uint128)'](liquidatorAccountId);
    });

    it('does not allow liquidation of account with healthy c-ratio', async () => {
      await assertRevert(
        systems()
          .Core.connect(user1)
          .liquidate(accountId, poolId, collateralAddress(), liquidatorAccountId),
        'IneligibleForLiquidation("1000000000000000000000", "0", "0", "1500000000000000000")',
        systems().Core
      );
    });

    describe('account goes into debt', () => {
      // this should put us very close to 110% c-ratio
      const debtAmount = depositAmount
        .mul(ethers.utils.parseEther('1'))
        .div(ethers.utils.parseEther('1.1'));

      before('take out a loan', async () => {
        await systems()
          .Core.connect(user1)
          .mintUsd(accountId, poolId, collateralAddress(), debtAmount.div(10));

        await systems()
          .Core.connect(user1)
          .withdraw(accountId, await systems().Core.getUsdToken(), debtAmount.div(10));
      });

      before('going into debt', async () => {
        await MockMarket().connect(user1).setReportedDebt(debtAmount.mul(9).div(10));

        // sanity
        assertBn.near(
          await systems().Core.callStatic.getVaultDebt(poolId, collateralAddress()),
          debtAmount
        );
      });

      it('cannot liquidate when its the only account in the pool', async () => {
        await assertRevert(
          systems()
            .Core.connect(user2)
            .liquidate(accountId, poolId, collateralAddress(), liquidatorAccountId),
          'MustBeVaultLiquidated()',
          systems().Core
        );
      });

      verifyUsesFeatureFlag(
        () => systems().Core,
        'liquidate',
        () =>
          systems()
            .Core.connect(user1)
            .liquidate(accountId, poolId, collateralAddress(), liquidatorAccountId)
      );

      // a second account is required to "absorb" the debt which is coming from the first account
      describe('another account joins', () => {
        const accountId2 = 56857923;

        // this is just the default from elsewhere
        const liquidationReward = ethers.utils.parseEther('20');

        before('add another account', async () => {
          await collateralContract()
            .connect(user1)
            .transfer(await user2.getAddress(), depositAmount.mul(10));
          await collateralContract()
            .connect(user2)
            .approve(systems().Core.address, depositAmount.mul(10));
          await systems().Core.connect(user2)['createAccount(uint128)'](accountId2);
          await systems()
            .Core.connect(user2)
            .deposit(accountId2, collateralAddress(), depositAmount.mul(10));

          // use the zero pool to get minted USD
          await systems()
            .Core.connect(user2)
            .delegateCollateral(
              accountId2,
              poolId,
              collateralAddress(),
              depositAmount.mul(10),
              ethers.utils.parseEther('1')
            );
        });

        let txn: ethers.providers.TransactionResponse;
        before('liquidate', async () => {
          txn = await systems()
            .Core.connect(user2)
            .liquidate(accountId, poolId, collateralAddress(), liquidatorAccountId);
        });

        it('erases the liquidated account', async () => {
          assertBn.isZero(
            await systems().Core.callStatic.getPositionCollateral(
              accountId,
              poolId,
              collateralAddress()
            )
          );
          assertBn.isZero(
            await systems().Core.callStatic.getPositionDebt(accountId, poolId, collateralAddress())
          );
        });

        it('sends correct reward to liquidating address', async () => {
          const liquidatorAccountCollateral = await systems().Core.getAccountCollateral(
            liquidatorAccountId,
            collateralAddress()
          );
          assertBn.equal(liquidatorAccountCollateral.totalDeposited, liquidationReward);
        });

        it('redistributes debt among remaining staker', async () => {
          // vault should still have same amounts (minus collateral from reward)
          assertBn.equal(
            (await systems().Core.callStatic.getVaultCollateral(poolId, collateralAddress()))[0],
            depositAmount.mul(11).sub(liquidationReward)
          );
          assertBn.near(
            await systems().Core.callStatic.getVaultDebt(poolId, collateralAddress()),
            debtAmount
          );
        });

        it('since its last position in vault, should have same amount of debt as whole vault', async () => {
          assertBn.equal(
            await systems().Core.callStatic.getVaultDebt(poolId, collateralAddress()),
            await systems().Core.callStatic.getPositionDebt(accountId2, poolId, collateralAddress())
          );
        });

        it('has reduced amount of total liquidity registered to the market', async () => {
          assertBn.equal(
            await systems().Core.callStatic.getMarketCollateral(marketId()),
            depositAmount.mul(11).sub(liquidationReward)
          );
        });

        it('emits correct event', async () => {
          await assertEvent(
            txn,
            `Liquidation(${accountId}, ${poolId}, "${collateralAddress()}", [${debtAmount.sub(
              1 // precision loss
            )}, ${depositAmount}, ${liquidationReward}], ${liquidatorAccountId}, "${await user2.getAddress()}")`,
            systems().Core
          );
        });
      });
    });
  });

  describe('liquidateVault()', () => {
    before(restore);

    it('does not allow liquidation with 0 max usd', async () => {
      await assertRevert(
        systems().Core.connect(user1).liquidateVault(poolId, collateralAddress(), accountId, 0),
        'InvalidParameter("maxUsd", "must be higher than 0")',
        systems().Core
      );
    });

    it('does not allow liquidation with an uninitialized account', async () => {
      await assertRevert(
        systems()
          .Core.connect(user1)
          .liquidateVault(poolId, collateralAddress(), 382387423936, ethers.utils.parseEther('1')),
        'AccountNotFound("382387423936")',
        systems().Core
      );
    });

    it('does not allow liquidation of vault with healthy c-ratio', async () => {
      await assertRevert(
        systems()
          .Core.connect(user1)
          .liquidateVault(poolId, collateralAddress(), accountId, ethers.utils.parseEther('1')),
        'IneligibleForLiquidation("1000000000000000000000", "0", "0", "1500000000000000000")',
        systems().Core
      );
    });

    describe('account goes into debt', () => {
      // this should put us very close to 110% c-ratio
      const debtAmount = depositAmount
        .mul(ethers.utils.parseEther('1'))
        .div(ethers.utils.parseEther('1.1'));

      before('take out a loan', async () => {
        await systems()
          .Core.connect(user1)
          .mintUsd(accountId, poolId, collateralAddress(), debtAmount.div(10));

        await systems()
          .Core.connect(user1)
          .withdraw(accountId, await systems().Core.getUsdToken(), debtAmount.div(10));
      });

      before('going into debt', async () => {
        await MockMarket().connect(user1).setReportedDebt(debtAmount.mul(9).div(10));

        // sanity
        assertBn.near(
          await systems().Core.callStatic.getVaultDebt(poolId, collateralAddress()),
          debtAmount
        );
      });

      verifyUsesFeatureFlag(
        () => systems().Core,
        'liquidateVault',
        () =>
          systems()
            .Core.connect(user1)
            .liquidateVault(poolId, collateralAddress(), accountId, debtAmount.div(4))
      );

      describe('successful partial liquidation', () => {
        const liquidatorAccountId = 384572397362837;

        const liquidatorAccountStartingBalance = debtAmount;

        let preCollateralRatio: ethers.BigNumber;

        before('create liquidator account', async () => {
          await systems().Core.connect(user2)['createAccount(uint128)'](liquidatorAccountId);
        });

        before('pool liquidator account', async () => {
          await collateralContract()
            .connect(user1)
            .transfer(await user2.getAddress(), depositAmount.mul(50));
          await collateralContract()
            .connect(user2)
            .approve(systems().Core.address, depositAmount.mul(50));
          await systems()
            .Core.connect(user2)
            .deposit(liquidatorAccountId, collateralAddress(), depositAmount.mul(50));
          await systems()
            .Core.connect(user2)
            .delegateCollateral(
              liquidatorAccountId,
              0,
              collateralAddress(),
              depositAmount.mul(50),
              ethers.utils.parseEther('1')
            );
          await systems()
            .Core.connect(user2)
            .mintUsd(liquidatorAccountId, 0, collateralAddress(), liquidatorAccountStartingBalance);

          await systems()
            .Core.connect(user2)
            .withdraw(
              liquidatorAccountId,
              await systems().Core.getUsdToken(),
              liquidatorAccountStartingBalance
            );
        });

        before('record collateral ratio', async () => {
          preCollateralRatio = await systems().Core.callStatic.getVaultCollateralRatio(
            poolId,
            collateralAddress()
          );
        });

        let txn: ethers.providers.TransactionResponse;
        before('liquidate', async () => {
          txn = await systems()
            .Core.connect(user2)
            .liquidateVault(poolId, collateralAddress(), liquidatorAccountId, debtAmount.div(4));
        });

        it('deducts USD from the caller', async () => {
          assertBn.equal(
            await systems().USD.balanceOf(await user2.getAddress()),
            liquidatorAccountStartingBalance.sub(debtAmount.div(4))
          );
        });

        let sentAmount: ethers.BigNumber;
        it('transfers some of vault collateral amount', async () => {
          sentAmount = depositAmount.sub(
            (await systems().Core.getVaultCollateral(poolId, collateralAddress()))[0]
          );

          assertBn.near(sentAmount, depositAmount.div(4));

          const liquidatorAccountCollateral = await systems().Core.getAccountCollateral(
            liquidatorAccountId,
            collateralAddress()
          );
          const deposited = liquidatorAccountCollateral[0];
          const assigned = liquidatorAccountCollateral[1];
          const availableAmount = deposited.sub(assigned);

          assertBn.equal(availableAmount, sentAmount);
        });

        it('keeps market c-ratio the same', async () => {
          assertBn.equal(
            await systems().Core.callStatic.getVaultCollateralRatio(poolId, collateralAddress()),
            preCollateralRatio
          );
        });

        it('emits correct event', async () => {
          await assertEvent(
            txn,
            `VaultLiquidation(${poolId}, "${collateralAddress()}", [${debtAmount.div(
              4
            )}, ${sentAmount}, ${sentAmount}], ${liquidatorAccountId}, "${await user2.getAddress()}")`,
            systems().Core
          );
        });

        describe('successful full liquidation', () => {
          let txn: ethers.providers.TransactionResponse;

          before('liquidate', async () => {
            txn = await systems()
              .Core.connect(user2)
              .liquidateVault(poolId, collateralAddress(), liquidatorAccountId, debtAmount);
          });

          it('sends collateral to the requested accountId', async () => {
            const liquidatorAccountCollateral = await systems().Core.getAccountCollateral(
              liquidatorAccountId,
              collateralAddress()
            );
            const deposited = liquidatorAccountCollateral[0];
            const assigned = liquidatorAccountCollateral[1];
            const availableAmount = deposited.sub(assigned);

            assertBn.equal(availableAmount, depositAmount);
          });

          it('vault is reset', async () => {
            assertBn.isZero(
              (await systems().Core.getVaultCollateral(poolId, collateralAddress()))[0]
            );
            assertBn.isZero(
              await systems().Core.callStatic.getVaultDebt(poolId, collateralAddress())
            );
          });

          it('emits correct event', async () => {
            await assertEvent(
              txn,
              `VaultLiquidation(${poolId}, "${collateralAddress()}", [${
                debtAmount.sub(debtAmount.div(4)).sub(1) // precious rounding
              }, ${sentAmount.mul(3)}, ${sentAmount.mul(
                3
              )}], ${liquidatorAccountId}, "${await user2.getAddress()}")`,
              systems().Core
            );
          });
        });
      });
    });
  });
});
