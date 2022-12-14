import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { ethers } from 'ethers';

import { bootstrapWithMockMarketAndPool } from '../../bootstrap';

describe('MarketManagerModule', function () {
  const {
    signers,
    systems,
    collateralAddress,
    poolId,
    accountId,
    MockMarket,
    marketId,
    depositAmount,
    restore,
  } = bootstrapWithMockMarketAndPool();

  const One = ethers.utils.parseEther('1');
  const Hundred = ethers.utils.parseEther('100');

  let owner: ethers.Signer, user1: ethers.Signer, user2: ethers.Signer;

  let txn: ethers.providers.TransactionResponse;

  before('identify signers', async () => {
    [owner, user1, user2] = signers();
  });

  describe('registerMarket()', async () => {
    before(restore);

    it('does not allow non-permissioned user to register market', async () => {
      await assertRevert(
        systems().Core.connect(user2).registerMarket(user1.getAddress()),
        'FeatureUnavailable'
      );
    });

    it('reverts when trying to register a market that does not support the IMarket interface', async function () {
      await assertRevert(
        systems()
          .Core.connect(owner)
          .registerMarket(await owner.getAddress()),
        `IncorrectMarketInterface("${await owner.getAddress()}")`
      );
    });

    describe('successful', async () => {
      const expectedMarketId = marketId().add(1);

      before('register', async () => {
        // user1 has access to register market from bootstrapWithMockMarketAndPool
        txn = await systems()
          .Core.connect(owner)
          .registerMarket(await user1.getAddress());
      });

      it('emits correct event', async () => {
        await assertEvent(
          txn,
          `MarketRegistered("${await user1.getAddress()}", "${expectedMarketId}")`,
          systems().Core
        );
      });

      it('liquidity is zero', async () => {
        assertBn.isZero(await systems().Core.getMarketCollateral(expectedMarketId));
      });

      it('totalDebt is zero', async () => {
        assertBn.isZero(await systems().Core.getMarketTotalDebt(expectedMarketId));
      });
    });
  });

  describe('deposit()', async () => {
    before(restore);

    before('acquire USD', async () => {
      await systems().Core.connect(user1).mintUsd(accountId, poolId, collateralAddress(), One);
    });

    it('should not work if user has not approved', async () => {
      await assertRevert(
        MockMarket().connect(user1).buySynth(One),
        `InsufficientAllowance("${One.toString()}", "0")`,
        systems().Core
      );
    });

    describe('success', async () => {
      before('deposit', async () => {
        await systems().USD.connect(user1).approve(MockMarket().address, One);
        txn = await MockMarket().connect(user1).buySynth(One);
      });

      it('takes USD away', async () => {
        assertBn.isZero(await systems().USD.balanceOf(await user1.getAddress()));
      });

      it('increases withdrawableUsd', async () => {
        assertBn.equal(
          await systems().Core.connect(user1).getWithdrawableUsd(marketId()),
          depositAmount.add(One)
        );
      });

      it('leaves totalDebt the same', async () => {
        assertBn.isZero(await systems().Core.connect(user1).getMarketTotalDebt(marketId()));
      });

      it('accrues no debt', async () => {
        // should only have the one USD minted earlier
        assertBn.equal(
          await systems().Core.callStatic.getVaultDebt(poolId, collateralAddress()),
          One
        );
      });
    });
  });

  describe('withdraw()', async () => {
    before(restore);

    describe('deposit into the pool', async () => {
      before('mint USD to use market', async () => {
        await systems().Core.connect(user1).mintUsd(accountId, poolId, collateralAddress(), One);
        await systems().USD.connect(user1).approve(MockMarket().address, One);
        txn = await MockMarket().connect(user1).buySynth(One);
      });

      it('reverts if not enough liquidity', async () => {
        const reportedDebtBefore = await MockMarket().connect(user1).reportedDebt(0);
        await MockMarket().connect(user1).setReportedDebt(Hundred.mul(100000));

        await assertRevert(
          MockMarket().connect(user1).sellSynth(Hundred.mul(100000)),
          `NotEnoughLiquidity("${marketId()}", "${Hundred.mul(100000).toString()}")`,
          systems().Core
        );

        await MockMarket().connect(user1).setReportedDebt(reportedDebtBefore);
      });

      describe('withdraw some from the market', async () => {
        before('mint USD to use market', async () => {
          txn = await (await MockMarket().connect(user1).sellSynth(One.div(2))).wait();
        });

        it('decreased withdrawable usd', async () => {
          const liquidity = await systems().Core.getWithdrawableUsd(marketId());
          assertBn.equal(liquidity, depositAmount.add(One.div(2)));
        });

        it('leaves totalDebt the same', async () => {
          assertBn.isZero(await systems().Core.connect(user1).getMarketTotalDebt(marketId()));
        });

        it('makes USD', async () => {
          assertBn.equal(await systems().USD.balanceOf(await user1.getAddress()), One.div(2));
        });

        describe('withdraw the rest', async () => {
          before('mint USD to use market', async () => {
            txn = await MockMarket().connect(user1).sellSynth(One.div(2));
          });

          it('decreased withdrawable usd', async () => {
            const liquidity = await systems().Core.getWithdrawableUsd(marketId());
            assertBn.equal(liquidity, depositAmount);
          });

          it('leaves totalDebt the same', async () => {
            assertBn.isZero(await systems().Core.connect(user1).getMarketTotalDebt(marketId()));
          });

          it('makes USD', async () => {
            assertBn.equal(await systems().USD.balanceOf(await user1.getAddress()), One);
          });
        });
      });
    });
  });
});
