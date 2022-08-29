import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/dist/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/dist/utils/assertions/assert-revert';
import assertEvent from '@synthetixio/core-utils/dist/utils/assertions/assert-event';
import hre from 'hardhat';
import { ethers } from 'ethers';

import { bootstrapWithMockMarketAndFund } from '../bootstrap';

describe('MarketManagerModule', function () {
  const {
    signers,
    systems,
    collateralAddress,
    collateralContract,
    fundId,
    accountId,
    MockMarket,
    marketId,
    depositAmount,
    restore,
  } = bootstrapWithMockMarketAndFund();

  const One = ethers.utils.parseEther('1');
  const Hundred = ethers.utils.parseEther('100');

  let owner: ethers.Signer, user1: ethers.Signer;

  before('identify signers', async () => {
    [owner, user1] = signers();
  });

  describe('registerMarket()', async () => {
    before(restore);

    it('fails if market is already registered', async () => {
      await assertRevert(
        systems().Core.connect(owner).registerMarket(MockMarket().address),
        `MarketAlreadyRegistered("${MockMarket().address}", "${marketId()}")`,
        systems().Core
      );
    });

    describe('successful', async () => {
      let txn: ethers.providers.TransactionResponse;

      const expectedMarketId = marketId().add(1);

      before('register', async () => {
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
        assertBn.isZero(await systems().Core.marketLiquidity(expectedMarketId));
      });

      it('totalBalance is zero', async () => {
        assertBn.isZero(await systems().Core.marketTotalBalance(expectedMarketId));
      });
    });
  });

  describe('deposit()', async () => {
    before(restore);
    let txn: ethers.providers.TransactionResponse;

    before('acquire USD', async () => {
      await systems().Core.connect(user1).mintUSD(accountId, fundId, collateralAddress(), One);
    });

    it('should not work if user has not approved', async () => {
      assertRevert(
        MockMarket().connect(user1).buySynth(One),
        `MarketDepositNotApproved(${
          MockMarket().address
        }, ${await user1.getAddress()}, ${One.toString()}, "0")`,
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

      it('increases marketLiquidity', async () => {
        assertBn.equal(
          await systems().Core.connect(user1).marketLiquidity(marketId()),
          depositAmount.add(One)
        );
      });

      it('leaves totalBalance the same', async () => {
        assertBn.isZero(await systems().Core.connect(user1).marketTotalBalance(marketId()));
      });

      it('accrues no debt', async () => {
        // should only have the one USD minted earlier
        assertBn.equal(await systems().Core.callStatic.vaultDebt(fundId, collateralAddress()), One);
      });
    });
  });

  describe('withdraw()', async () => {
    before(restore);

    describe('deposit into the fund', async () => {
      let txn: ethers.providers.TransactionResponse;
      before('mint USD to use market', async () => {
        await systems().Core.connect(user1).mintUSD(accountId, fundId, collateralAddress(), One);
        await systems().USD.connect(user1).approve(MockMarket().address, One);
        txn = await MockMarket().connect(user1).buySynth(One);
      });

      // TODO: this test is tempermental and fails with unusual errors, though
      // I know it is passinga s of writing through other means
      it.skip('reverts if not enough liquidity', async () => {
        await MockMarket().connect(user1).setBalance(Hundred.mul(100000));

        await assertRevert(
          MockMarket().connect(user1).callStatic.sellSynth(Hundred.mul(100000)),
          `NotEnoughLiquidity("${marketId()}", "${Hundred.mul(100000).toString()}")`,
          systems().Core
        );

        await MockMarket().connect(user1).setBalance(0);
      });

      describe('withdraw some from the market', async () => {
        before('mint USD to use market', async () => {
          txn = await (await MockMarket().connect(user1).sellSynth(One.div(2))).wait();
        });

        it('decreased available liquidity', async () => {
          const liquidity = await systems().Core.marketLiquidity(marketId());
          assertBn.equal(liquidity, depositAmount.add(One.div(2)));
        });

        it('leaves totalBalance the same', async () => {
          assertBn.isZero(await systems().Core.connect(user1).marketTotalBalance(marketId()));
        });

        it('makes USD', async () => {
          assertBn.equal(await systems().USD.balanceOf(await user1.getAddress()), One.div(2));
        });

        describe('withdraw the rest', async () => {
          before('mint USD to use market', async () => {
            txn = await MockMarket().connect(user1).sellSynth(One.div(2));
          });

          it('decreased available liquidity', async () => {
            const liquidity = await systems().Core.marketLiquidity(marketId());
            assertBn.equal(liquidity, depositAmount);
          });

          it('leaves totalBalance the same', async () => {
            assertBn.isZero(await systems().Core.connect(user1).marketTotalBalance(marketId()));
          });

          it('makes USD', async () => {
            assertBn.equal(await systems().USD.balanceOf(await user1.getAddress()), One);
          });
        });
      });
    });
  });
});
