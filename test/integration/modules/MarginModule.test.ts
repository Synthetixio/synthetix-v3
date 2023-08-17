import { ethers } from 'ethers';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assert from 'assert';
import { shuffle } from 'lodash';
import { bootstrap } from '../../bootstrap';
import {
  bn,
  genAddress,
  genBootstrap,
  genBytes32,
  genNumber,
  genListOf,
  genOneOf,
  genTrader,
  genOrder,
} from '../../generators';
import { ZERO_ADDRESS, approveAndMintMargin, commitAndSettle, commitOrder, depositMargin } from '../../helpers';

describe('MarginModule', async () => {
  const bs = bootstrap(genBootstrap());
  const { markets, collaterals, traders, owner, systems, restore } = bs;

  beforeEach(restore);

  describe('modifyCollateral', () => {
    it('should noop with a modify amount of 0', async () => {
      const { PerpMarketProxy } = systems();

      const trader = genOneOf(traders());
      const market = genOneOf(markets());
      const collateral = genOneOf(collaterals()).contract.connect(trader.signer);
      const amountDelta = bn(0);

      const tx = await PerpMarketProxy.connect(trader.signer).modifyCollateral(
        trader.accountId,
        market.marketId(),
        collateral.address,
        amountDelta
      );
      const receipt = await tx.wait();

      assert.equal(receipt.events?.length, 0);
    });

    it('should emit all events in correct order');

    it('should recompute funding');

    it('should revert on modify when an order is pending', async () => {
      const { PerpMarketProxy } = systems();
      const gTrader1 = await genTrader(bs);

      await depositMargin(bs, gTrader1);
      const order = await genOrder(bs, gTrader1.market, gTrader1.collateral, gTrader1.collateralDepositAmount);

      // We are using the same trader/market for both deposit and withdraws.
      const { trader, marketId } = gTrader1;

      // Commit an order for this trader.
      await PerpMarketProxy.connect(trader.signer).commitOrder(
        trader.accountId,
        marketId,
        order.sizeDelta,
        order.limitPrice,
        order.keeperFeeBufferUsd
      );

      // Verify that an order exists.
      const pendingOrder = await PerpMarketProxy.getOrderDigest(trader.accountId, marketId);
      assertBn.equal(pendingOrder.sizeDelta, order.sizeDelta);

      // (deposit) Same trader in the same market but (possibly) different collateral.
      const gTrader2 = await genTrader(bs, { desiredTrader: trader, desiredMarket: gTrader1.market });

      // (deposit) Mint and give access.
      await approveAndMintMargin(bs, gTrader2);

      // (deposit) Perform deposit but expect failure.
      await assertRevert(
        PerpMarketProxy.connect(trader.signer).modifyCollateral(
          trader.accountId,
          marketId,
          gTrader2.collateral.contract.address,
          gTrader2.collateralDepositAmount
        ),
        `OrderFound("${trader.accountId}")`
      );

      // (withdraw) Attempt to withdraw previously deposted margin but expect fail.
      await assertRevert(
        PerpMarketProxy.connect(trader.signer).modifyCollateral(
          trader.accountId,
          marketId,
          gTrader1.collateral.contract.address,
          gTrader1.collateralDepositAmount.mul(-1)
        ),
        `OrderFound("${trader.accountId}")`
      );
    });

    it('should revert when modifying collateral of another account', async () => {
      const { PerpMarketProxy } = systems();

      const trader1 = traders()[0];
      const trader2 = traders()[1];

      const gTrader = await genTrader(bs, { desiredTrader: trader1 });
      const { market, collateral, collateralDepositAmount } = gTrader;
      await approveAndMintMargin(bs, gTrader);

      // Connected using trader2 for an accountId that belongs to trader1.
      const permission = ethers.utils.formatBytes32String('PERPS_MODIFY_COLLATERAL');
      const signerAddress = await trader2.signer.getAddress();
      await assertRevert(
        PerpMarketProxy.connect(trader2.signer).modifyCollateral(
          trader1.accountId,
          market.marketId(),
          collateral.contract.address,
          collateralDepositAmount
        ),
        `PermissionDenied("${trader1.accountId}", "${permission}", "${signerAddress}")`
      );
    });

    describe('deposit', () => {
      it('should allow deposit of collateral', async () => {
        const { PerpMarketProxy } = systems();

        const trader = genOneOf(traders());
        const traderAddress = await trader.signer.getAddress();

        const market = genOneOf(markets());
        const collateral = genOneOf(collaterals()).contract.connect(trader.signer);

        const amountDelta = bn(genNumber(50, 100_000));
        await collateral.mint(trader.signer.getAddress(), amountDelta);
        await collateral.approve(PerpMarketProxy.address, amountDelta);

        const balanceBefore = await collateral.balanceOf(traderAddress);

        const tx = await PerpMarketProxy.connect(trader.signer).modifyCollateral(
          trader.accountId,
          market.marketId(),
          collateral.address,
          amountDelta
        );
        const feeAmount = 0; // fee amount for sUSD can be configured in core system MarketManager
        await assertEvent(
          tx,
          `MarginDeposit("${traderAddress}", "${PerpMarketProxy.address}", ${amountDelta}, ${feeAmount} "${collateral.address}")`,
          PerpMarketProxy
        );

        const expectedBalanceAfter = balanceBefore.sub(amountDelta);
        assertBn.equal(await collateral.balanceOf(traderAddress), expectedBalanceAfter);
      });

      it('should affect an existing position when depositing', async () => {
        const { PerpMarketProxy } = systems();

        const gTrader = genTrader(bs);
        const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(bs, gTrader);
        const order = await genOrder(bs, market, collateral, collateralDepositAmount);
        const { accountId } = trader;

        // Create a new position.
        await commitAndSettle(bs, marketId, trader, order);

        // Verify this position has been created successfully.
        const positionDigest = await PerpMarketProxy.getPositionDigest(accountId, marketId);
        assertBn.equal(positionDigest.size, order.sizeDelta);

        // Get pre deposit collateralUsd.
        const collateralUsd1 = await PerpMarketProxy.getCollateralUsd(accountId, marketId);

        // Deposit more margin and verify and get post deposit collateralUsd.
        const deposit2 = await depositMargin(bs, gTrader);
        const collateralUsd2 = await PerpMarketProxy.getCollateralUsd(accountId, marketId);

        // Due to rounding this can be really close but not exact. For example, during testing I encountered
        // a scenario where `getCollateralUsd` returned 9999999999999999999996, which is 9999.999999999999999996. So,
        // extremely close but not exact. Sometimes the amounts would match exactly.
        assertBn.near(collateralUsd2, collateralUsd1.add(deposit2.marginUsdDepositAmount));
      });

      it('should revert deposit to an account that does not exist', async () => {
        const { PerpMarketProxy } = systems();

        const trader = genOneOf(traders());
        const invalidAccountId = genNumber(42069, 50000);

        const market = genOneOf(markets());
        const collateral = genOneOf(collaterals()).contract.connect(trader.signer);

        const amountDelta = bn(genNumber(50, 100_000));
        await collateral.mint(trader.signer.getAddress(), amountDelta);
        await collateral.approve(PerpMarketProxy.address, amountDelta);

        await assertRevert(
          PerpMarketProxy.connect(trader.signer).modifyCollateral(
            invalidAccountId,
            market.marketId(),
            collateral.address,
            amountDelta
          ),
          `AccountNotFound("${invalidAccountId}")`
        );
      });

      it('should revert depositing to a market that does not exist', async () => {
        const { PerpMarketProxy } = systems();

        const gTrader = genTrader(bs);
        const { trader, collateral, collateralDepositAmount } = await approveAndMintMargin(bs, gTrader);
        const invalidMarketId = bn(genNumber(42069, 50_000));

        // Perform deposit with invalid market id.
        await assertRevert(
          PerpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            invalidMarketId,
            collateral.contract.address,
            collateralDepositAmount
          ),
          `MarketNotFound("${invalidMarketId}")`,
          PerpMarketProxy
        );
      });

      it('should revert deposit of unsupported collateral', async () => {
        const { PerpMarketProxy } = systems();

        const trader = genOneOf(traders());
        const market = genOneOf(markets());
        const invalidCollateralAddress = genAddress();
        const amountDelta = bn(genNumber(10, 100));

        await assertRevert(
          PerpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            market.marketId(),
            invalidCollateralAddress,
            amountDelta
          ),
          `UnsupportedCollateral("${invalidCollateralAddress}")`
        );
      });

      it('should revert when depositing an address(0) collateral', async () => {
        const { PerpMarketProxy } = systems();

        const trader = genOneOf(traders());
        const market = genOneOf(markets());
        const marketId = market.marketId();
        const collateral = genOneOf(collaterals()).contract.connect(trader.signer);

        const depositAmountDelta = bn(genNumber(500, 1000));
        await collateral.mint(trader.signer.getAddress(), depositAmountDelta);
        await collateral.approve(PerpMarketProxy.address, depositAmountDelta);

        // Perform withdraw with zero address.
        await assertRevert(
          PerpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            marketId,
            ZERO_ADDRESS,
            depositAmountDelta
          ),
          'ZeroAddress()',
          PerpMarketProxy
        );
      });

      it('should revert deposit that exceeds max cap', async () => {
        const { PerpMarketProxy } = systems();

        const trader = genOneOf(traders());
        const market = genOneOf(markets());

        const { contract, max: maxAllowable } = genOneOf(collaterals());
        const collateral = contract.connect(trader.signer);

        // Add one extra to max allowable to exceed max cap.
        const depositAmountDelta = maxAllowable.add(bn(1));
        await collateral.mint(trader.signer.getAddress(), depositAmountDelta);
        await collateral.approve(PerpMarketProxy.address, depositAmountDelta);

        await assertRevert(
          PerpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            market.marketId(),
            collateral.address,
            depositAmountDelta
          ),
          `MaxCollateralExceeded("${depositAmountDelta}", "${maxAllowable}")`
        );
      });

      it('should revert deposit of perp market approved collateral but not system approved');

      it('should revert when insufficient amount of collateral in msg.sender', async () => {
        const { PerpMarketProxy } = systems();

        const trader = genOneOf(traders());
        const market = genOneOf(markets());
        const collateral = genOneOf(collaterals()).contract.connect(trader.signer);

        // Ensure the amount available is lower than amount to deposit (i.e. depositing more than available).
        const amountToDeposit = bn(genNumber(100, 1000));
        const amountAvailable = amountToDeposit.sub(bn(genNumber(50, 99)));

        await collateral.mint(trader.signer.getAddress(), amountAvailable);
        await collateral.approve(PerpMarketProxy.address, amountAvailable);

        await assertRevert(
          PerpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            market.marketId(),
            collateral.address,
            amountToDeposit
          ),
          `InsufficientAllowance("${amountToDeposit}", "${amountAvailable}")`
        );
      });

      it('should revert when account is flagged for liquidation');
    });

    describe('withdraw', () => {
      it('should allow full withdraw of collateral from my account', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, traderAddress, marketId, collateral, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs)
        );

        // Perform the withdraw (full amount).
        const tx = await PerpMarketProxy.connect(trader.signer).modifyCollateral(
          trader.accountId,
          marketId,
          collateral.contract.address,
          collateralDepositAmount.mul(-1)
        );

        await assertEvent(
          tx,
          `MarginWithdraw("${PerpMarketProxy.address}", "${traderAddress}", ${collateralDepositAmount}, "${collateral.contract.address}")`,
          PerpMarketProxy
        );
      });

      it('should allow partial withdraw of collateral to my account', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, traderAddress, marketId, collateral, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs)
        );
        const collateralAddress = collateral.contract.address;

        // Perform the withdraw (partial amount).
        const withdrawAmount = collateralDepositAmount.div(2).mul(-1);
        const tx = await PerpMarketProxy.connect(trader.signer).modifyCollateral(
          trader.accountId,
          marketId,
          collateralAddress,
          withdrawAmount
        );

        // Convert withdrawAmount back to positive beacuse Transfer takes in abs(amount).
        const withdrawAmountAbs = withdrawAmount.abs();
        await assertEvent(
          tx,
          `MarginWithdraw("${PerpMarketProxy.address}", "${traderAddress}", ${withdrawAmountAbs}, "${collateralAddress}")`,
          PerpMarketProxy
        );
      });

      it('should allow partial withdraw when margin req are still met');

      it('should allow affecting existing position when withdrawing');

      it('should revert withdraw on address(0) collateral', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));

        // Perform withdraw with zero address.
        await assertRevert(
          PerpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            marketId,
            ZERO_ADDRESS,
            collateralDepositAmount.mul(-1)
          ),
          'ZeroAddress()',
          PerpMarketProxy
        );
      });

      it('should revert withdraw to an account that does not exist', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
        const invalidAccountId = bn(genNumber(42069, 50_000));

        // Perform withdraw with zero address.
        await assertRevert(
          PerpMarketProxy.connect(trader.signer).modifyCollateral(
            invalidAccountId,
            marketId,
            collateral.contract.address,
            collateralDepositAmount.mul(-1)
          ),
          `AccountNotFound("${invalidAccountId}")`,
          PerpMarketProxy
        );
      });

      it('should revert withdraw to a market that does not exist', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
        const invalidMarketId = bn(genNumber(42069, 50_000));

        // Perform withdraw with zero address.
        await assertRevert(
          PerpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            invalidMarketId,
            collateral.contract.address,
            collateralDepositAmount.mul(-1)
          ),
          `MarketNotFound("${invalidMarketId}")`,
          PerpMarketProxy
        );
      });

      it('should revert withdraw of unsupported collateral', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
        const invalidCollateralAddress = genAddress();

        // Perform withdraw with zero address.
        await assertRevert(
          PerpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            marketId,
            invalidCollateralAddress,
            collateralDepositAmount.mul(-1)
          ),
          `UnsupportedCollateral("${invalidCollateralAddress}")`,
          PerpMarketProxy
        );
      });

      it('should revert withdraw of more than what is available', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));

        // Perform the withdraw with a little more than what was deposited.
        const withdrawAmount = collateralDepositAmount.add(bn(1)).mul(-1);

        await assertRevert(
          PerpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            marketId,
            collateral.contract.address,
            withdrawAmount
          ),
          `InsufficientCollateral("${collateral.contract.address}", "${collateralDepositAmount}", "${withdrawAmount.mul(
            -1
          )}")`,
          PerpMarketProxy
        );
      });

      it('should revert withdraw when margin below im');

      it('should revert withdraw if places position into liquidation');

      it('should revert when account is flagged for liquidation');
    });

    describe('withdrawAllCollateral', () => {
      it('should withdrawal all account collateral', async () => {
        const { PerpMarketProxy } = systems();
        const gTrader = await genTrader(bs);

        // We want to make sure we have two different types of collateral
        const collateral = collaterals()[0];
        const collateral2 = collaterals()[1];

        // Deposit margin with collateral 1
        const { trader, traderAddress, marketId, collateralDepositAmount } = await depositMargin(
          bs,
          Promise.resolve({ ...gTrader, collateral })
        );
        // Deposit margin with collateral 2
        const { collateralDepositAmount: collateralDepositAmount2 } = await depositMargin(
          bs,
          Promise.resolve({ ...gTrader, collateral: collateral2 })
        );

        // Assert deposit went thorough and  we have two different types of collateral
        const accountDigest = await PerpMarketProxy.getAccountDigest(trader.accountId, marketId);
        const { available: collateralBalance = bn(0) } =
          accountDigest.collateral.find((c) => c.collateralType === collateral.contract.address) || {};
        const { available: collateral2Balance = bn(0) } =
          accountDigest.collateral.find((c) => c.collateralType === collateral2.contract.address) || {};

        assertBn.equal(collateralBalance, collateralDepositAmount);
        assertBn.equal(collateral2Balance, collateralDepositAmount2);

        // Store balances before withdrawal
        const collateralWalletBalanceBeforeWithdrawal = await collateral.contract.balanceOf(traderAddress);
        const collateralWalletBalanceBeforeWithdrawal2 = await collateral2.contract.balanceOf(traderAddress);

        // Perform the withdrawAllCollateral
        const tx = await PerpMarketProxy.connect(trader.signer).withdrawAllCollateral(trader.accountId, marketId);

        // Assert that events are triggered
        await assertEvent(
          tx,
          `MarginWithdraw("${PerpMarketProxy.address}", "${traderAddress}", ${collateralDepositAmount}, "${collateral.contract.address}")`,
          PerpMarketProxy
        );
        await assertEvent(
          tx,
          `MarginWithdraw("${PerpMarketProxy.address}", "${traderAddress}", ${collateralDepositAmount2}, "${collateral2.contract.address}")`,
          PerpMarketProxy
        );

        // Assert that no collateral is left the market
        const accountDigestAfter = await PerpMarketProxy.getAccountDigest(trader.accountId, marketId);
        const { available: collateralBalanceAfter = bn(0) } =
          accountDigestAfter.collateral.find((c) => c.collateralType === collateral.contract.address) || {};
        const { available: collateral2BalanceAfter = bn(0) } =
          accountDigestAfter.collateral.find((c) => c.collateralType === collateral2.contract.address) || {};

        assertBn.equal(collateralBalanceAfter, bn(0));
        assertBn.equal(collateral2BalanceAfter, bn(0));

        // Assert that we have the collateral back in the trader's wallet
        assertBn.equal(
          await collateral.contract.balanceOf(traderAddress),
          collateralDepositAmount.add(collateralWalletBalanceBeforeWithdrawal)
        );
        assertBn.equal(
          await collateral2.contract.balanceOf(traderAddress),
          collateralDepositAmount2.add(collateralWalletBalanceBeforeWithdrawal2)
        );
      });

      it('should noop when account has no collateral to withdraw');

      it('should revert when account does not exist', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId } = await depositMargin(bs, genTrader(bs));
        const invalidAccountId = bn(genNumber(42069, 50_000));

        // Perform withdraw with invalid account
        await assertRevert(
          PerpMarketProxy.connect(trader.signer).withdrawAllCollateral(invalidAccountId, marketId),
          `AccountNotFound("${invalidAccountId}")`,
          PerpMarketProxy
        );
      });

      it('should revert when market does not exist', async () => {
        const { PerpMarketProxy } = systems();
        const { trader } = await depositMargin(bs, genTrader(bs));
        const invalidMarketId = bn(genNumber(42069, 50_000));

        // Perform withdraw with invalid market
        await assertRevert(
          PerpMarketProxy.connect(trader.signer).withdrawAllCollateral(trader.accountId, invalidMarketId),
          `MarketNotFound("${invalidMarketId}")`,
          PerpMarketProxy
        );
      });

      it('should revert when trader have open order', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId, collateral, market, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs)
        );
        await commitOrder(bs, marketId, trader, await genOrder(bs, market, collateral, collateralDepositAmount));

        // Perform withdraw with invalid market
        await assertRevert(
          PerpMarketProxy.connect(trader.signer).withdrawAllCollateral(trader.accountId, marketId),
          `OrderFound("${trader.accountId}")`,
          PerpMarketProxy
        );
      });

      it('should revert when trader has an open position', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId, collateral, market, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs)
        );
        await commitAndSettle(bs, marketId, trader, await genOrder(bs, market, collateral, collateralDepositAmount));

        // Perform withdraw with invalid market
        await assertRevert(
          PerpMarketProxy.connect(trader.signer).withdrawAllCollateral(trader.accountId, marketId),
          `PositionFound("${trader.accountId}", "${marketId}")`,
          PerpMarketProxy
        );
      });

      it('should revert when withdrawing all collateral of another account', async () => {
        const { PerpMarketProxy } = systems();

        const trader1 = traders()[0];
        const trader2 = traders()[1];
        const market = markets()[0];

        // Deposit many types of collateral for trader1.
        for (const collateral of collaterals()) {
          await depositMargin(
            bs,
            genTrader(bs, { desiredTrader: trader1, desiredCollateral: collateral, desiredMarket: market })
          );
        }

        // Now attempt to withdraw everything using trader2.
        const permission = ethers.utils.formatBytes32String('PERPS_MODIFY_COLLATERAL');
        const signerAddress = await trader2.signer.getAddress();
        await assertRevert(
          PerpMarketProxy.connect(trader2.signer).withdrawAllCollateral(trader1.accountId, market.marketId()),
          `PermissionDenied("${trader1.accountId}", "${permission}", "${signerAddress}")`
        );
      });
    });
  });

  describe('setCollateralConfiguration', () => {
    it('should revert when array has mismatched length', async () => {
      const { PerpMarketProxy, Collateral2Mock, Collateral3Mock } = systems();
      const from = owner();

      // `maxAllowables` to have _at least_ 6 elements to ensure there's _always_ a mismatch.
      const collateralTypes = shuffle([Collateral2Mock.address, Collateral3Mock.address]);
      const oracleNodeIds = genListOf(genNumber(1, 5), () => genBytes32());
      const maxAllowables = genListOf(genNumber(6, 10), () => bn(genNumber(10_000, 100_000)));

      await assertRevert(
        PerpMarketProxy.connect(from).setCollateralConfiguration(collateralTypes, oracleNodeIds, maxAllowables),
        `ArrayLengthMismatch()`
      );
    });

    it('should configure many collaterals, also tests getConfiguredCollaterals', async () => {
      const { PerpMarketProxy, Collateral2Mock, Collateral3Mock } = systems();
      const from = owner();

      // Unfortunately `collateralTypes` must be a real ERC20 contract otherwise this will fail due to the `.approve`.
      const collateralTypes = shuffle([Collateral2Mock.address, Collateral3Mock.address]);
      const n = collateralTypes.length;
      const oracleNodeIds = genListOf(n, () => genBytes32());
      const maxAllowables = genListOf(n, () => bn(genNumber(10_000, 100_000)));

      const tx = await PerpMarketProxy.connect(from).setCollateralConfiguration(
        collateralTypes,
        oracleNodeIds,
        maxAllowables
      );
      const collaterals = await PerpMarketProxy.getConfiguredCollaterals();

      assert.equal(collaterals.length, n);
      collaterals.forEach((collateral, i) => {
        const { maxAllowable, collateralType, oracleNodeId } = collateral;
        assertBn.equal(maxAllowable, maxAllowables[i]);
        assert.equal(collateralType, collateralTypes[i]);
        assert.equal(oracleNodeId, oracleNodeIds[i]);
      });

      await assertEvent(tx, `CollateralConfigured("${await from.getAddress()}", ${n})`, PerpMarketProxy);
    });

    it('should reset existing collaterals when new config is empty', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();

      await PerpMarketProxy.connect(from).setCollateralConfiguration([], [], []);
      const collaterals = await PerpMarketProxy.getConfiguredCollaterals();

      assert.equal(collaterals.length, 0);
    });

    it('should revert when non-owners configuring collateral', async () => {
      const { PerpMarketProxy } = systems();
      const from = await traders()[0].signer.getAddress();
      await assertRevert(
        PerpMarketProxy.connect(from).setCollateralConfiguration([], [], []),
        `Unauthorized("${from}")`
      );
    });

    it('should revert when max allowable is negative', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();
      await assertRevert(
        PerpMarketProxy.connect(from).setCollateralConfiguration([genAddress()], [genBytes32()], [bn(-1)]),
        'Error: value out-of-bounds'
      );
    });

    it('should revert when type is address(0)', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();
      await assertRevert(
        PerpMarketProxy.connect(from).setCollateralConfiguration([ZERO_ADDRESS], [genBytes32()], [bn(genNumber())]),
        'ZeroAddress()'
      );
    });

    it('should revoke/approve collateral with 0/maxAllowable');
  });
  describe('getCollateralUsd', () => {
    it('should return marginUsd that reflects value of collateral when no positions opened');

    it('should return zero marginUsd when no collateral has been depoisted');

    it('should return marginUsd + value of position when in profit');

    it('should return marginUsd - value of position when not in profit');

    it('should not consider a position in a different market for the same account');

    it('should revert when accountId does not exist');

    it('should revert when marketId does not exist');
  });
});
