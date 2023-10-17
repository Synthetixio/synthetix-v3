import { BigNumber, ethers, utils } from 'ethers';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { wei } from '@synthetixio/wei';
import assert from 'assert';
import { shuffle } from 'lodash';
import { bootstrap } from '../../bootstrap';
import {
  bn,
  genBootstrap,
  genNumber,
  genListOf,
  genOneOf,
  genTrader,
  genOrder,
  toRoundRobinGenerators,
} from '../../generators';
import {
  mintAndApproveWithTrader,
  commitAndSettle,
  commitOrder,
  depositMargin,
  extendContractAbi,
  fastForwardBySec,
  findEventSafe,
  mintAndApprove,
  BURN_ADDRESS,
  withExplicitEvmMine,
} from '../../helpers';
import { calcPnl } from '../../calculations';
import { assertEvents } from '../../assert';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';

describe('MarginModule', async () => {
  const bs = bootstrap(genBootstrap());
  const { markets, collaterals, collateralsWithoutSusd, traders, owner, systems, provider, restore } = bs;

  beforeEach(restore);

  describe('modifyCollateral', () => {
    it('should cancel order when modifying if pending order exists and expired (withdraw)', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

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

      // Fastforward to expire the pending order.
      const { maxOrderAge } = await PerpMarketProxy.getMarketConfiguration();
      await fastForwardBySec(provider(), maxOrderAge.toNumber() + 1);

      const { receipt } = await withExplicitEvmMine(
        () =>
          PerpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            marketId,
            collateral.synthMarketId(),
            collateralDepositAmount.mul(-1)
          ),
        provider()
      );

      const marginWithdrawEventProperties = [
        `"${PerpMarketProxy.address}"`,
        `"${await trader.signer.getAddress()}"`,
        collateralDepositAmount,
        collateral.synthMarketId(),
      ].join(', ');

      await assertEvent(receipt, `OrderCanceled()`, PerpMarketProxy);
      await assertEvent(receipt, `MarginWithdraw(${marginWithdrawEventProperties})`, PerpMarketProxy);
    });

    it('should revert when a transfer amount of 0', async () => {
      const { PerpMarketProxy } = systems();

      const trader = genOneOf(traders());
      const market = genOneOf(markets());
      const collateral = genOneOf(collaterals());
      const amountDelta = bn(0);

      await assertRevert(
        PerpMarketProxy.connect(trader.signer).modifyCollateral(
          trader.accountId,
          market.marketId(),
          collateral.synthMarketId(),
          amountDelta
        ),
        `ZeroAmount()`
      );
    });

    it('should recompute funding', async () => {
      const { PerpMarketProxy } = systems();
      const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));

      // Create a new position.
      await commitAndSettle(bs, marketId, trader, genOrder(bs, market, collateral, collateralDepositAmount));

      // Provision collateral and approve for access.
      const { collateralDepositAmount: collateralDepositAmount2 } = await mintAndApproveWithTrader(
        bs,
        genTrader(bs, { desiredMarket: market, desiredTrader: trader, desiredCollateral: collateral })
      );

      // Perform the deposit.
      const { receipt } = await withExplicitEvmMine(
        () =>
          PerpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            market.marketId(),
            collateral.synthMarketId(),
            collateralDepositAmount2
          ),
        provider()
      );
      await assertEvent(receipt, `FundingRecomputed`, PerpMarketProxy);
    });

    it('should revert on modify when an order is pending', async () => {
      const { PerpMarketProxy } = systems();

      const { market, collateral, collateralDepositAmount, marketId, trader } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

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
      const gTrader2 = await genTrader(bs, { desiredTrader: trader, desiredMarket: market });

      // (deposit) Mint and give access.
      await mintAndApproveWithTrader(bs, gTrader2);

      // (deposit) Perform deposit but expect failure.
      await assertRevert(
        PerpMarketProxy.connect(trader.signer).modifyCollateral(
          trader.accountId,
          marketId,
          gTrader2.collateral.synthMarketId(),
          gTrader2.collateralDepositAmount
        ),
        `OrderFound()`
      );

      // (withdraw) Attempt to withdraw previously deposited margin but expect fail.
      await assertRevert(
        PerpMarketProxy.connect(trader.signer).modifyCollateral(
          trader.accountId,
          marketId,
          collateral.synthMarketId(),
          collateralDepositAmount.mul(-1)
        ),
        `OrderFound()`
      );
    });

    it('should revert when modifying collateral of another account', async () => {
      const { PerpMarketProxy } = systems();
      const tradersGenerator = toRoundRobinGenerators(shuffle(traders()));

      const {
        market,
        collateral,
        collateralDepositAmount,
        trader: trader1,
      } = await mintAndApproveWithTrader(bs, genTrader(bs, { desiredTrader: tradersGenerator.next().value }));

      const permission = ethers.utils.formatBytes32String('PERPS_MODIFY_COLLATERAL');
      const trader2 = tradersGenerator.next().value;
      // Connected using trader2 for an accountId that belongs to trader1.
      const signerAddress = await trader2.signer.getAddress();
      await assertRevert(
        PerpMarketProxy.connect(trader2.signer).modifyCollateral(
          trader1.accountId,
          market.marketId(),
          collateral.synthMarketId(),
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
        const collateral = genOneOf(collaterals());
        const amountDelta = bn(genNumber(50, 100_000));

        await mintAndApprove(bs, collateral, amountDelta, trader.signer);

        const balanceBefore = await collateral.contract.balanceOf(traderAddress);

        const { receipt } = await withExplicitEvmMine(
          () =>
            PerpMarketProxy.connect(trader.signer).modifyCollateral(
              trader.accountId,
              market.marketId(),
              collateral.synthMarketId(),
              amountDelta
            ),
          provider()
        );

        const marginDepositEventProperties = [
          `"${traderAddress}"`,
          `"${PerpMarketProxy.address}"`,
          amountDelta,
          collateral.synthMarketId(),
        ].join(', ');
        await assertEvent(receipt, `MarginDeposit(${marginDepositEventProperties})`, PerpMarketProxy);

        const expectedBalanceAfter = balanceBefore.sub(amountDelta);
        assertBn.equal(await collateral.contract.balanceOf(traderAddress), expectedBalanceAfter);
      });

      it('should emit depositMarketUsd when using sUSD as collateral'); // To write this test we need to configure `globalConfig.usdToken` as collateral in bootstrap.

      it('should emit all events in correct order', async () => {
        const { PerpMarketProxy, Core } = systems();

        const gTrader = await genTrader(bs);
        await mintAndApproveWithTrader(bs, gTrader);
        const { collateral, trader, traderAddress, collateralDepositAmount, marketId } = gTrader;
        const { accountId, signer } = trader;

        // Perform the deposit.
        const tx = await PerpMarketProxy.connect(signer).modifyCollateral(
          accountId,
          marketId,
          collateral.synthMarketId(),
          collateralDepositAmount
        );

        // Create a contract that can parse all events emitted.
        const contractsWithAllEvents = extendContractAbi(
          PerpMarketProxy,
          Core.interface
            .format(utils.FormatTypes.full)
            .concat(['event Transfer(address indexed from, address indexed to, uint256 value)'])
        );

        const marketCollateralDepositedEventProperties = [
          marketId,
          `"${collateral.synthAddress()}"`,
          collateralDepositAmount,
          `"${PerpMarketProxy.address}"`,
        ].join(', ');
        const marginDepositEventProperties = [
          `"${traderAddress}"`,
          `"${PerpMarketProxy.address}"`,
          collateralDepositAmount,
          collateral.synthMarketId(),
        ].join(', ');
        await assertEvents(
          tx,
          [
            /FundingRecomputed/,
            `Transfer("${traderAddress}", "${PerpMarketProxy.address}", ${collateralDepositAmount})`, // From collateral ERC20 contract
            `Transfer("${PerpMarketProxy.address}", "${Core.address}", ${collateralDepositAmount})`, // From collateral ERC20 contract
            `MarketCollateralDeposited(${marketCollateralDepositedEventProperties})`, // From core.
            `MarginDeposit(${marginDepositEventProperties})`,
          ],
          contractsWithAllEvents
        );
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
        const collateral = genOneOf(collaterals());
        const amountDelta = bn(genNumber(50, 100_000));

        await mintAndApprove(bs, collateral, amountDelta, trader.signer);

        await assertRevert(
          PerpMarketProxy.connect(trader.signer).modifyCollateral(
            invalidAccountId,
            market.marketId(),
            collateral.synthMarketId(),
            amountDelta
          ),
          `PermissionDenied("${invalidAccountId}"`
        );
      });

      it('should revert depositing to a market that does not exist', async () => {
        const { PerpMarketProxy } = systems();

        const gTrader = genTrader(bs);
        const { trader, collateral, collateralDepositAmount } = await mintAndApproveWithTrader(bs, gTrader);
        const invalidMarketId = bn(genNumber(42069, 50_000));

        // Perform deposit with invalid market id.
        await assertRevert(
          PerpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            invalidMarketId,
            collateral.synthMarketId(),
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
        const invalidSynthMarketId = genNumber(69, 420);
        const amountDelta = bn(genNumber(10, 100));

        await assertRevert(
          PerpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            market.marketId(),
            invalidSynthMarketId,
            amountDelta
          ),
          `UnsupportedCollateral("${invalidSynthMarketId}")`
        );
      });

      it('should revert deposit that exceeds max cap', async () => {
        const { PerpMarketProxy } = systems();

        const trader = genOneOf(traders());
        const market = genOneOf(markets());

        const collateral = genOneOf(collaterals());
        const depositAmountDelta = collateral.max.add(bn(1)); // +1 to maxAllowable to exceeded cap.

        await mintAndApprove(bs, collateral, depositAmountDelta, trader.signer);

        await assertRevert(
          PerpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            market.marketId(),
            collateral.synthMarketId(),
            depositAmountDelta
          ),
          `MaxCollateralExceeded("${depositAmountDelta}", "${collateral.max}")`
        );
      });

      it('should revert deposit that exceeds market-wide max cap', async () => {
        const { PerpMarketProxy } = systems();

        const tradersGenerator = toRoundRobinGenerators(shuffle(traders()));
        const trader1 = tradersGenerator.next().value;
        const trader2 = tradersGenerator.next().value;

        const market = genOneOf(markets());

        const collateral = genOneOf(collaterals());
        const depositAmountDelta1 = collateral.max; // Exactly at cap.
        const depositAmountDelta2 = bn(genNumber(1, 10)); // A few units above cap.

        await mintAndApprove(bs, collateral, depositAmountDelta1, trader1.signer);
        await mintAndApprove(bs, collateral, depositAmountDelta2, trader2.signer);

        await PerpMarketProxy.connect(trader1.signer).modifyCollateral(
          trader1.accountId,
          market.marketId(),
          collateral.synthMarketId(),
          depositAmountDelta1
        );

        // Exceeded cap (across two accounts and hence market wide).
        await assertRevert(
          PerpMarketProxy.connect(trader2.signer).modifyCollateral(
            trader2.accountId,
            market.marketId(),
            collateral.synthMarketId(),
            depositAmountDelta2
          ),
          `MaxCollateralExceeded("${depositAmountDelta2}", "${collateral.max}")`
        );
      });

      it('should revert when insufficient amount of collateral in msg.sender', async () => {
        const { PerpMarketProxy } = systems();

        const trader = genOneOf(traders());
        const market = genOneOf(markets());
        const collateral = genOneOf(collaterals());

        // Ensure the amount available is lower than amount to deposit (i.e. depositing more than available).
        const amountToDeposit = bn(genNumber(100, 1000));
        const amountAvailable = amountToDeposit.sub(bn(genNumber(50, 99)));

        await mintAndApprove(bs, collateral, amountAvailable, trader.signer);

        await assertRevert(
          PerpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            market.marketId(),
            collateral.synthMarketId(),
            amountToDeposit
          ),
          `InsufficientAllowance("${amountToDeposit}", "${amountAvailable}")`
        );
      });

      it('should revert when account is flagged for liquidation', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs)
        );
        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredSide: -1,
          desiredLeverage: 10,
        });

        // Open leveraged position.
        await commitAndSettle(bs, marketId, trader, order);

        // Updating price, causing position to be liquidatable.
        await market.aggregator().mockSetCurrentPrice(wei(order.oraclePrice).mul(2).toBN());

        // Flag position.
        await PerpMarketProxy.flagPosition(trader.accountId, marketId);

        // Mint some more collateral.
        await mintAndApprove(bs, collateral, collateralDepositAmount, trader.signer);

        await assertRevert(
          PerpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            marketId,
            collateral.synthMarketId(),
            collateralDepositAmount
          ),
          `PositionFlagged()`,
          PerpMarketProxy
        );
      });
    });

    describe('withdraw', () => {
      it('should allow full withdraw of collateral from my account', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, traderAddress, marketId, collateral, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs)
        );

        // Perform the withdraw (full amount).
        const { receipt } = await withExplicitEvmMine(
          () =>
            PerpMarketProxy.connect(trader.signer).modifyCollateral(
              trader.accountId,
              marketId,
              collateral.synthMarketId(),
              collateralDepositAmount.mul(-1)
            ),
          provider()
        );

        const marginWithdrawEventProperties = [
          `"${PerpMarketProxy.address}"`,
          `"${traderAddress}"`,
          collateralDepositAmount,
          collateral.synthMarketId(),
        ].join(', ');

        await assertEvent(receipt, `MarginWithdraw(${marginWithdrawEventProperties})`, PerpMarketProxy);
      });

      it('should emit withdrawMarketUsd when using sUSD as collateral'); // To write this test we need to configure `globalConfig.usdToken` as collateral in bootstrap.

      it('should emit all events in correct order', async () => {
        const { PerpMarketProxy, Core } = systems();
        const { trader, marketId, collateral, collateralDepositAmount, traderAddress } = await depositMargin(
          bs,
          genTrader(bs, { desiredCollateral: bs.collaterals()[0] })
        );
        const withdrawAmount = wei(collateralDepositAmount).mul(0.5).toBN();

        // Perform the deposit.
        const tx = await PerpMarketProxy.connect(trader.signer).modifyCollateral(
          trader.accountId,
          marketId,
          collateral.synthMarketId(),
          withdrawAmount.mul(-1)
        );

        // Create a contract that can parse all events emitted
        const contractsWithAllEvents = extendContractAbi(
          PerpMarketProxy,
          Core.interface
            .format(utils.FormatTypes.full)
            .concat(['event Transfer(address indexed from, address indexed to, uint256 value)'])
        );

        const marginWithdrawEventProperties = [
          `"${PerpMarketProxy.address}"`,
          `"${traderAddress}"`,
          withdrawAmount,
          collateral.synthMarketId(),
        ].join(', ');

        await assertEvents(
          tx,
          [
            /FundingRecomputed/,
            `Transfer("${Core.address}", "${PerpMarketProxy.address}", ${withdrawAmount})`, // From collateral ERC20 contract
            `MarketCollateralWithdrawn(${marketId}, "${collateral.contract.address}", ${withdrawAmount}, "${PerpMarketProxy.address}")`, // From core
            `Transfer("${PerpMarketProxy.address}", "${traderAddress}", ${withdrawAmount})`, // From collateral ERC20 contract
            `MarginWithdraw(${marginWithdrawEventProperties})`,
          ],
          contractsWithAllEvents
        );
      });

      it('should allow partial withdraw of collateral to my account', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, traderAddress, marketId, collateral, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs)
        );

        // Perform the withdraw (partial amount).
        const withdrawAmount = collateralDepositAmount.div(2).mul(-1);
        const tx = await PerpMarketProxy.connect(trader.signer).modifyCollateral(
          trader.accountId,
          marketId,
          collateral.synthMarketId(),
          withdrawAmount
        );

        const marginWithdrawEventProperties = [
          `"${PerpMarketProxy.address}"`,
          `"${traderAddress}"`,
          withdrawAmount.abs(), // Convert to positive because `Transfer` takes in abs(amount).
          collateral.synthMarketId(),
        ].join(', ');

        await assertEvent(tx, `MarginWithdraw(${marginWithdrawEventProperties})`, PerpMarketProxy);
      });

      it('should allow partial withdraw when initial margin req are still met', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId, market, collateral, collateralDepositAmount, collateralPrice, traderAddress } =
          await depositMargin(bs, genTrader(bs));

        // Open leveraged position.
        await commitAndSettle(
          bs,
          marketId,
          trader,
          genOrder(bs, market, collateral, collateralDepositAmount, {
            desiredSide: -1,
            desiredLeverage: 5,
          })
        );

        const { im, remainingMarginUsd } = await PerpMarketProxy.getPositionDigest(trader.accountId, marketId);

        // Figure out max withdraw.
        const maxWithdrawUsd = wei(remainingMarginUsd).sub(im);
        const maxWithdraw = maxWithdrawUsd.div(collateralPrice);

        // Withdraw 90% of max withdraw.
        const withdrawAmount = maxWithdraw.mul(0.9);

        // Store balance to compare later.
        const balanceBefore = await collateral.contract.balanceOf(traderAddress);

        const { receipt } = await withExplicitEvmMine(
          () =>
            PerpMarketProxy.connect(trader.signer).modifyCollateral(
              trader.accountId,
              marketId,
              collateral.synthMarketId(),
              withdrawAmount.mul(-1).toBN()
            ),
          provider()
        );
        const marginWithdrawEventProperties = [
          `"${PerpMarketProxy.address}"`,
          `"${traderAddress}"`,
          withdrawAmount.toBN(),
          collateral.synthMarketId(),
        ].join(', ');
        await assertEvent(receipt, `MarginWithdraw(${marginWithdrawEventProperties})`, PerpMarketProxy);

        const expectedBalanceAfter = wei(balanceBefore).add(withdrawAmount).toBN();
        const balanceAfter = await collateral.contract.balanceOf(traderAddress);
        assertBn.equal(expectedBalanceAfter, balanceAfter);
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
            collateral.synthMarketId(),
            collateralDepositAmount.mul(-1)
          ),
          `PermissionDenied("${invalidAccountId}"`,
          PerpMarketProxy
        );
      });

      it('should revert withdraw from market that does not exist', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
        const invalidMarketId = bn(genNumber(42069, 50_000));

        // Perform withdraw with zero address.
        await assertRevert(
          PerpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            invalidMarketId,
            collateral.synthMarketId(),
            collateralDepositAmount.mul(-1)
          ),
          `MarketNotFound("${invalidMarketId}")`,
          PerpMarketProxy
        );
      });

      it('should revert withdraw of unsupported collateral', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
        const invalidSynthMarketId = genNumber(69, 420);

        // Perform withdraw with invalid synth market id.
        await assertRevert(
          PerpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            marketId,
            invalidSynthMarketId,
            collateralDepositAmount.mul(-1)
          ),
          `UnsupportedCollateral("${invalidSynthMarketId}")`,
          PerpMarketProxy
        );
      });

      it('should revert withdraw of more than what is available', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));

        // Perform the withdraw with a little more than what was deposited.
        const withdrawAmount = collateralDepositAmount.add(bn(1)).mul(-1);

        const insufficientCollateralEventProperties = [
          `"${collateral.synthMarketId()}"`,
          `"${collateralDepositAmount}"`,
          `"${withdrawAmount.mul(-1)}"`,
        ].join(', ');

        await assertRevert(
          PerpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            marketId,
            collateral.synthMarketId(),
            withdrawAmount
          ),
          `InsufficientCollateral(${insufficientCollateralEventProperties})`,
          PerpMarketProxy
        );
      });

      it('should revert withdraw when margin below im', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId, market, collateral, collateralDepositAmount, collateralPrice } = await depositMargin(
          bs,
          genTrader(bs)
        );
        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredSide: -1,
          desiredLeverage: 5,
        });

        // Open leveraged position
        await commitAndSettle(bs, marketId, trader, order);

        const { im, remainingMarginUsd } = await PerpMarketProxy.getPositionDigest(trader.accountId, marketId);
        const maxWithdrawUsd = wei(remainingMarginUsd).sub(im);

        // Try withdrawing $1 more than max withdraw in native units.
        const amountToWithdrawUsd = maxWithdrawUsd.add(1);
        const amountToWithdraw = amountToWithdrawUsd.div(collateralPrice);

        /**
         * Error: Transaction was expected to revert with "InsufficientMargin()", but reverted with "CanLiquidatePosition()"
         * Error: transaction reverted in contract MarginModule: CanLiquidatePosition()
         *
         * Need to make sure we are not liquidatable
         */
        await assertRevert(
          PerpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            marketId,
            collateral.synthMarketId(),
            amountToWithdraw.mul(-1).toBN()
          ),
          `InsufficientMargin()`,
          PerpMarketProxy
        );
      });

      it('should revert withdraw if places position into liquidation', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs)
        );
        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredSide: -1,
          desiredLeverage: 10,
        });

        // Open leveraged position
        await commitAndSettle(bs, marketId, trader, order);

        await assertRevert(
          PerpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            marketId,
            collateral.synthMarketId(),
            collateralDepositAmount.mul(-1)
          ),
          `CanLiquidatePosition()`,
          PerpMarketProxy
        );
      });

      it('should revert withdraw if position is liquidatable due to price', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs)
        );
        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredSide: -1,
          desiredLeverage: 10,
        });

        // Open leveraged position.
        await commitAndSettle(bs, marketId, trader, order);

        // Change market price to make position liquidatable.
        await market.aggregator().mockSetCurrentPrice(wei(order.oraclePrice).mul(2).toBN());

        await assertRevert(
          PerpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            marketId,
            collateral.synthMarketId(),
            wei(-0.01).toBN()
          ),
          `CanLiquidatePosition()`,
          PerpMarketProxy
        );
      });

      it('should revert when account is flagged for liquidation', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs)
        );
        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredSide: -1,
          desiredLeverage: 10,
        });
        // Open leveraged position
        await commitAndSettle(bs, marketId, trader, order);

        // Updating price, causing position to be liquidatable
        await market.aggregator().mockSetCurrentPrice(wei(order.oraclePrice).mul(2).toBN());

        // Flag position
        await PerpMarketProxy.flagPosition(trader.accountId, marketId);

        await assertRevert(
          PerpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            marketId,
            collateral.synthMarketId(),
            collateralDepositAmount.mul(-1)
          ),
          `PositionFlagged()`,
          PerpMarketProxy
        );
      });
    });

    describe('withdrawAllCollateral', () => {
      it('should withdraw all account collateral', async () => {
        const { PerpMarketProxy } = systems();

        const collateralGenerator = toRoundRobinGenerators(shuffle(collaterals()));

        // Deposit margin with collateral 1
        const { trader, traderAddress, marketId, collateralDepositAmount, collateral, market } = await depositMargin(
          bs,
          genTrader(bs, { desiredCollateral: collateralGenerator.next().value })
        );

        // Deposit margin with collateral 2
        const { collateralDepositAmount: collateralDepositAmount2, collateral: collateral2 } = await depositMargin(
          bs,
          genTrader(bs, {
            desiredMarket: market,
            desiredCollateral: collateralGenerator.next().value,
            desiredTrader: trader,
          })
        );

        // Assert deposit went thorough and we have two different types of collateral.
        const accountDigest = await PerpMarketProxy.getAccountDigest(trader.accountId, marketId);

        const { available: collateralBalance = bn(0) } =
          accountDigest.depositedCollaterals.find(({ synthMarketId }) =>
            synthMarketId.eq(collateral.synthMarketId())
          ) || {};
        const { available: collateral2Balance = bn(0) } =
          accountDigest.depositedCollaterals.find(({ synthMarketId }) =>
            synthMarketId.eq(collateral2.synthMarketId())
          ) || {};

        assertBn.equal(collateralBalance, collateralDepositAmount);
        assertBn.equal(collateral2Balance, collateralDepositAmount2);

        // Store balances before withdrawal.
        const collateralWalletBalanceBeforeWithdrawal = await collateral.contract.balanceOf(traderAddress);
        const collateralWalletBalanceBeforeWithdrawal2 = await collateral2.contract.balanceOf(traderAddress);

        // Perform the `withdrawAllCollateral`.
        const { receipt } = await withExplicitEvmMine(
          () => PerpMarketProxy.connect(trader.signer).withdrawAllCollateral(trader.accountId, marketId),
          provider()
        );

        // Assert that events are triggered.
        await assertEvent(
          receipt,
          `MarginWithdraw("${
            PerpMarketProxy.address
          }", "${traderAddress}", ${collateralDepositAmount}, ${collateral.synthMarketId()})`,
          PerpMarketProxy
        );
        await assertEvent(
          receipt,
          `MarginWithdraw("${
            PerpMarketProxy.address
          }", "${traderAddress}", ${collateralDepositAmount2}, ${collateral2.synthMarketId()})`,
          PerpMarketProxy
        );

        // Assert that no collateral is left the market
        const accountDigestAfter = await PerpMarketProxy.getAccountDigest(trader.accountId, marketId);
        const { available: collateralBalanceAfter = bn(0) } =
          accountDigestAfter.depositedCollaterals.find(({ synthMarketId }) =>
            synthMarketId.eq(collateral.synthMarketId())
          ) || {};
        const { available: collateral2BalanceAfter = bn(0) } =
          accountDigestAfter.depositedCollaterals.find(({ synthMarketId }) =>
            synthMarketId.eq(collateral2.synthMarketId())
          ) || {};

        assertBn.isZero(collateralBalanceAfter);
        assertBn.isZero(collateral2BalanceAfter);

        // Assert that we have the collateral back in the trader's wallet.
        assertBn.equal(
          await collateral.contract.balanceOf(traderAddress),
          collateralDepositAmount.add(collateralWalletBalanceBeforeWithdrawal)
        );
        assertBn.equal(
          await collateral2.contract.balanceOf(traderAddress),
          collateralDepositAmount2.add(collateralWalletBalanceBeforeWithdrawal2)
        );
      });

      it('should cancel order when withdrawing all if pending order exists and expired');

      it('should recompute funding', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, market } = await depositMargin(bs, genTrader(bs));

        // Perform the deposit.
        const { receipt } = await withExplicitEvmMine(
          () => PerpMarketProxy.connect(trader.signer).withdrawAllCollateral(trader.accountId, market.marketId()),
          provider()
        );
        await assertEvent(receipt, `FundingRecomputed()`, PerpMarketProxy);
      });

      it('should withdraw with fees and funding removed when no price changes', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId, market, collateral, collateralDepositAmount, traderAddress, collateralPrice } =
          await depositMargin(bs, genTrader(bs));

        // Some generated collateral, trader combinations results with balance > `collateralDepositAmount`. So this
        // because the first collateral (sUSD) is partly configured by Synthetix Core. All traders receive _a lot_ of
        // that collateral so we need to track the full balance here.
        //
        // @see: https://github.com/Synthetixio/synthetix-v3/blob/main/protocol/synthetix/test/common/stakers.ts#L65
        const startingCollateralBalance = wei(await collateral.contract.balanceOf(traderAddress)).add(
          collateralDepositAmount
        );

        // Open an order
        const openOrder = await genOrder(bs, market, collateral, collateralDepositAmount);
        const { receipt: openReceipt } = await commitAndSettle(bs, marketId, trader, openOrder);

        // Close the order
        const closeOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredSize: wei(openOrder.sizeDelta).mul(-1).toBN(),
        });

        const { receipt: closeReceipt } = await commitAndSettle(bs, marketId, trader, closeOrder);

        // Get the fees from the open and close order events
        const openOrderEvent = findEventSafe({
          receipt: openReceipt,
          eventName: 'OrderSettled',
          contract: PerpMarketProxy,
        });
        const closeOrderEvent = findEventSafe({
          receipt: closeReceipt,
          eventName: 'OrderSettled',
          contract: PerpMarketProxy,
        });
        const fees = wei(openOrderEvent?.args.orderFee)
          .add(openOrderEvent?.args.keeperFee)
          .add(closeOrderEvent?.args.orderFee)
          .add(closeOrderEvent?.args.keeperFee);

        // Pnl expected to be close to 0 since not oracle price change
        const pnl = calcPnl(openOrder.sizeDelta, closeOrder.fillPrice, openOrder.fillPrice);
        const expectedChangeUsd = wei(pnl).sub(fees).add(closeOrderEvent?.args.accruedFunding);
        const expectedChange = expectedChangeUsd.div(collateralPrice);

        // Perform the withdrawal.
        await PerpMarketProxy.connect(trader.signer).withdrawAllCollateral(trader.accountId, marketId);
        const actualBalance = await collateral.contract.balanceOf(traderAddress);

        assertBn.lt(expectedChange.toBN(), wei(0).toBN());

        assertBn.equal(actualBalance, startingCollateralBalance.add(expectedChange).toBN());
      });

      it('should withdraw correct amounts after winning position', async () => {
        const { PerpMarketProxy, USD } = systems();
        const tradersGenerator = toRoundRobinGenerators(shuffle(traders()));

        const { trader, marketId, market, collateral, collateralDepositAmount, traderAddress } = await depositMargin(
          bs,
          genTrader(bs, { desiredTrader: tradersGenerator.next().value })
        );

        // Some generated collateral, trader combinations results with balance > `collateralDepositAmount`. So this
        // because the first collateral (sUSD) is partly configured by Synthetix Core. All traders receive _a lot_ of
        // that collateral so we need to track the full balance here.
        //
        // @see: https://github.com/Synthetixio/synthetix-v3/blob/main/protocol/synthetix/test/common/stakers.ts#L65
        const startingCollateralBalance = wei(await collateral.contract.balanceOf(traderAddress)).add(
          collateralDepositAmount
        );

        // Open an order
        const openOrder = await genOrder(bs, market, collateral, collateralDepositAmount);
        const { receipt: openReceipt } = await commitAndSettle(bs, marketId, trader, openOrder);
        const isLong = openOrder.sizeDelta.gt(0);

        // Increase or decrease price 20%
        const newPrice = wei(openOrder.oraclePrice).mul(isLong ? 1.2 : 0.8);
        await market.aggregator().mockSetCurrentPrice(newPrice.toBN());

        // Close the order
        const closeOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredSize: wei(openOrder.sizeDelta).mul(-1).toBN(),
        });

        const { receipt: closeReceipt } = await commitAndSettle(bs, marketId, trader, closeOrder);

        // Get the fees from the open and close order events
        const openOrderEvent = findEventSafe({
          receipt: openReceipt,
          eventName: 'OrderSettled',
          contract: PerpMarketProxy,
        });
        const closeOrderEvent = findEventSafe({
          receipt: closeReceipt,
          eventName: 'OrderSettled',
          contract: PerpMarketProxy,
        });

        const pnl = calcPnl(openOrder.sizeDelta, closeOrder.fillPrice, openOrder.fillPrice);
        const orderFees = wei(openOrderEvent?.args.orderFee).add(closeOrderEvent?.args.orderFee);
        const keeperFees = wei(openOrderEvent?.args.keeperFee).add(closeOrderEvent?.args.keeperFee);
        const fees = orderFees.add(keeperFees);
        const expectedProfit = wei(pnl).sub(fees).add(closeOrderEvent?.args.accruedFunding);

        // Perform the withdrawal.
        await PerpMarketProxy.connect(trader.signer).withdrawAllCollateral(trader.accountId, marketId);

        // We expect to get back our full starting collateral balance.
        const actualBalance = await collateral.contract.balanceOf(traderAddress);
        assertBn.equal(actualBalance, startingCollateralBalance.toBN());

        const actualUsdBalance = await USD.balanceOf(traderAddress);
        // Our pnl, minus fees, funding should be equal to our sUSD balance.
        assertBn.equal(actualUsdBalance, expectedProfit.toBN());

        // Everything has been withdrawn. There should be no reportedDebt for this market.
        assertBn.isZero(await PerpMarketProxy.reportedDebt(marketId));
      });

      it('should withdraw correct amount after losing position', async () => {
        const { PerpMarketProxy, SpotMarket, Core } = systems();

        const tradersGenerator = toRoundRobinGenerators(shuffle(traders()));

        // Deposit margin with collateral 1.
        const {
          trader,
          traderAddress,
          marketId,
          collateralDepositAmount,
          marginUsdDepositAmount,
          market,
          collateral,
          collateralPrice,
        } = await depositMargin(
          bs,
          genTrader(bs, {
            desiredTrader: tradersGenerator.next().value,
          })
        );

        // TODO: Investigate this (@joey is this TODO still needed?)
        //
        // Some generated collateral, trader combinations results with balance > `collateralDepositAmount`. So this
        // because the first collateral (sUSD) is partly configured by Synthetix Core. All traders receive _a lot_ of
        // that collateral so we need to track the full balance here.
        //
        // @see: https://github.com/Synthetixio/synthetix-v3/blob/main/protocol/synthetix/test/common/stakers.ts#L65
        const startingCollateralBalance = wei(await collateral.contract.balanceOf(traderAddress)).add(
          collateralDepositAmount
        );

        // Deposit some additional collateral from another trader to avoid InsufficientMarketCollateralWithdrawable.
        await depositMargin(
          bs,
          genTrader(bs, {
            desiredTrader: tradersGenerator.next().value, // Use another trader
            desiredCollateral: collateral, // Use same collateral
            desiredMarginUsdDepositAmount: wei(marginUsdDepositAmount).mul(2).toNumber(), // Use margin * 2
          })
        );

        const openOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredSide: 1,
          desiredLeverage: 1,
        });

        const { receipt: openReceipt } = await commitAndSettle(bs, marketId, trader, openOrder);

        // Collect some data for calculation.
        const { args: openEventArgs } =
          findEventSafe({
            receipt: openReceipt,
            contract: PerpMarketProxy,
            eventName: 'OrderSettled',
          }) || {};

        // Make sure we lose some to funding.
        const currentBlockTimestamp = (await provider().getBlock('latest')).timestamp;
        await fastForwardTo(currentBlockTimestamp + genNumber(3000, 100000), provider());

        // Price change causing 50% loss.
        await market.aggregator().mockSetCurrentPrice(wei(openOrder.oraclePrice).mul(0.5).toBN());

        // Change collateral price 10% win.
        const newCollateralPrice = wei(collateralPrice).mul(1.1);
        await collateral.setPrice(newCollateralPrice.toBN());

        const closeOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredSize: wei(openOrder.sizeDelta).mul(-1).toBN(),
        });
        // Close the order with a loss
        const { receipt: closeReceipt } = await commitAndSettle(bs, marketId, trader, closeOrder);

        // Collect some data for calculation.
        const { args: closeEventArgs } =
          findEventSafe({
            receipt: closeReceipt,
            contract: PerpMarketProxy,
            eventName: 'OrderSettled',
          }) || {};
        const { args: marketUsdDepositedArgs } =
          findEventSafe({
            receipt: closeReceipt,
            contract: Core,
            eventName: 'MarketUsdDeposited',
          }) || {};

        // Calculate things for assertions
        const pnl = calcPnl(openOrder.sizeDelta, closeOrder.fillPrice, openOrder.fillPrice);
        const openOrderFees = wei(openOrder.orderFee).add(openEventArgs?.keeperFee);
        const closeOrderFees = wei(closeOrder.orderFee).add(closeEventArgs?.keeperFee);
        const collateralMarketId = collateral.synthMarketId();
        const [keeperAddress, blockTimestamp] = await Promise.all([
          bs.keeper().getAddress(),
          provider()
            .getBlock(closeReceipt.blockHash)
            .then(({ timestamp }) => timestamp),
        ]);

        // Calculate diff amount.
        const usdDiffAmount = wei(pnl).sub(openOrderFees).sub(closeOrderFees).add(closeEventArgs?.accruedFunding);
        const collateralDiffAmount = usdDiffAmount.div(newCollateralPrice);

        /**
         * Assert close position call. We want to make sure we've interacted with v3 Core correctly
         */

        // usdDiffAmount will have some rounding errors, make sure our calculated value it's "near" marketUsdDepositedArgs?.amount,
        // and then use marketUsdDepositedArgs?.amount when matching events
        assertBn.near(marketUsdDepositedArgs?.amount, usdDiffAmount.abs().toBN(), wei('0.000001').toBN());

        const dollarAmount = marketUsdDepositedArgs?.amount;
        const amount = wei(marketUsdDepositedArgs?.amount).div(newCollateralPrice).toBN();

        // Assert events from all contracts, to make sure CORE's market manager is paid correctly
        await assertEvents(
          closeReceipt,
          [
            /PriceFeedUpdate/, // Pyth events
            /BatchPriceFeedUpdate/, // Pyth events
            /FundingRecomputed/, // funding recomputed, don't care about the exact values here
            `Transfer("${Core.address}", "${PerpMarketProxy.address}", ${amount})`,
            `MarketCollateralWithdrawn(${marketId}, "${collateral.contract.address}", ${amount}, "${PerpMarketProxy.address}")`, // withdraw collateral, to sell to pay back losing pos in sUSD
            `Transfer("${PerpMarketProxy.address}", "${BURN_ADDRESS}", ${amount})`, // withdraw collateral, to sell to pay back losing pos in sUSD
            `Transfer("${BURN_ADDRESS}", "${PerpMarketProxy.address}", ${dollarAmount})`, // emitted from selling synths
            `MarketUsdWithdrawn(${collateralMarketId}, "${PerpMarketProxy.address}", ${dollarAmount}, "${SpotMarket.address}")`, // emitted from selling synthe
            `SynthSold(${collateralMarketId}, ${dollarAmount}, [0, 0, 0, 0], 0, "${BURN_ADDRESS}", ${newCollateralPrice.toBN()})`, // Sell collateral to sUSD to pay back losing pos
            `Transfer("${PerpMarketProxy.address}", "${BURN_ADDRESS}", ${dollarAmount})`, // part of depositing sUSD to market manager
            `MarketUsdDeposited(${marketId}, "${PerpMarketProxy.address}", ${dollarAmount}, "${PerpMarketProxy.address}")`, // deposit sUSD into market manager, this will let LPs of this market profit
            `Transfer("${BURN_ADDRESS}", "${keeperAddress}", ${closeEventArgs?.keeperFee})`, // Part of withdrawing sUSD to pay keeper
            `MarketUsdWithdrawn(${marketId}, "${keeperAddress}", ${closeEventArgs?.keeperFee}, "${PerpMarketProxy.address}")`, // Withdraw sUSD to pay keeper, note here that this amount is covered by the traders losses, so this amount will be included in MarketUsdDeposited
            `OrderSettled(${trader.accountId}, ${marketId}, ${blockTimestamp}, ${closeOrder.sizeDelta}, ${closeOrder.orderFee}, ${closeEventArgs?.keeperFee}, ${closeEventArgs?.accruedFunding}, ${closeEventArgs?.pnl}, ${closeOrder.fillPrice})`, // Order settled.
          ],
          // PerpsMarket abi gets events from Core, SpotMarket, Pyth and ERC20 added
          extendContractAbi(
            PerpMarketProxy,
            Core.interface
              .format(utils.FormatTypes.full)
              .concat(SpotMarket.interface.format(utils.FormatTypes.full))
              .concat([
                'event Transfer(address indexed from, address indexed to, uint256 value)', //ERC20
                'event PriceFeedUpdate(bytes32 indexed id, uint64 publishTime, int64 price, uint64 conf)', // Pyth
                'event BatchPriceFeedUpdate(uint16 chainId, uint64 sequenceNumber)', // Pyth
              ])
          )
        );

        // Actually do the withdraw.
        await PerpMarketProxy.connect(trader.signer).withdrawAllCollateral(trader.accountId, marketId);

        const expectedCollateralBalanceAfterTrade = wei(startingCollateralBalance).add(collateralDiffAmount).toBN();
        const balanceAfterTrade = await collateral.contract.balanceOf(traderAddress);

        // We expect to be losing.
        assertBn.lt(collateralDiffAmount.toBN(), 0);

        // Assert that the balance is correct.
        assertBn.equal(expectedCollateralBalanceAfterTrade, balanceAfterTrade);

        // Everything has been withdrawn. There should be no reportedDebt for this market.
        assertBn.near(await PerpMarketProxy.reportedDebt(marketId), BigNumber.from(0), bn(0.00001));
      });

      it('should revert with InsufficientMarketCollateralWithdrawable from synthetix.MarketCollateralModule');

      it('should revert when account has no collateral to withdraw', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId } = await genTrader(bs);

        await assertRevert(
          PerpMarketProxy.connect(trader.signer).withdrawAllCollateral(trader.accountId, marketId),
          `NilCollateral()`,
          PerpMarketProxy
        );
      });

      it('should revert when account does not exist', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId } = await depositMargin(bs, genTrader(bs));
        const invalidAccountId = bn(genNumber(42069, 50_000));

        // Perform withdraw with invalid account
        await assertRevert(
          PerpMarketProxy.connect(trader.signer).withdrawAllCollateral(invalidAccountId, marketId),
          `PermissionDenied("${invalidAccountId}"`,
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

      it('should revert when trader has a pending order', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId, collateral, market, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs)
        );
        await commitOrder(bs, marketId, trader, await genOrder(bs, market, collateral, collateralDepositAmount));

        // Perform withdraw with invalid market
        await assertRevert(
          PerpMarketProxy.connect(trader.signer).withdrawAllCollateral(trader.accountId, marketId),
          `OrderFound()`,
          PerpMarketProxy
        );
      });

      it('should revert when trader has an open position', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId, collateral, market, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs)
        );
        await commitAndSettle(bs, marketId, trader, genOrder(bs, market, collateral, collateralDepositAmount));

        // Perform withdraw with invalid market
        await assertRevert(
          PerpMarketProxy.connect(trader.signer).withdrawAllCollateral(trader.accountId, marketId),
          `PositionFound("${trader.accountId}", "${marketId}")`,
          PerpMarketProxy
        );
      });

      it('should revert when withdrawing all collateral of another account', async () => {
        const { PerpMarketProxy } = systems();

        const tradersGenerator = toRoundRobinGenerators(shuffle(traders()));
        const trader1 = tradersGenerator.next().value;
        const trader2 = tradersGenerator.next().value;
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

      it('should revert when flagged', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs)
        );
        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredSide: -1,
          desiredLeverage: 10,
        });

        // Open leveraged position.
        await commitAndSettle(bs, marketId, trader, order);

        // Updating price, causing position to be liquidatable.
        await market.aggregator().mockSetCurrentPrice(wei(order.oraclePrice).mul(2).toBN());

        // Flag position.
        await PerpMarketProxy.flagPosition(trader.accountId, marketId);
        await assertRevert(
          PerpMarketProxy.connect(trader.signer).withdrawAllCollateral(trader.accountId, marketId),
          `PositionFlagged()`,
          PerpMarketProxy
        );
      });
    });
  });

  describe('setCollateralConfiguration', () => {
    it('should revert when array has mismatched length', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();

      const synthMarketIds = [collaterals()[0].synthMarketId(), collaterals()[1].synthMarketId()];
      const maxAllowables = genListOf(genNumber(3, 10), () => bn(genNumber(10_000, 100_000)));

      await assertRevert(
        PerpMarketProxy.connect(from).setCollateralConfiguration(synthMarketIds, maxAllowables),
        `ArrayLengthMismatch()`
      );
    });

    it('should configure and return many collaterals configured', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();

      const newCollaterals = shuffle(collaterals());
      const newSynthMarketIds = newCollaterals.map(({ synthMarketId }) => synthMarketId());
      const newMaxAllowables = genListOf(newCollaterals.length, () => bn(genNumber(10_000, 100_000)));

      const tx = await PerpMarketProxy.connect(from).setCollateralConfiguration(newSynthMarketIds, newMaxAllowables);
      const configuredCollaterals = await PerpMarketProxy.getConfiguredCollaterals();

      assert.equal(configuredCollaterals.length, newCollaterals.length);

      for (const [_i, configuredCollateral] of Object.entries(configuredCollaterals)) {
        const idx = parseInt(_i);
        const synth = newCollaterals[idx].contract;

        const perpAllowance = await synth.allowance(PerpMarketProxy.address, PerpMarketProxy.address);
        const coreAllowance = await synth.allowance(PerpMarketProxy.address, bs.systems().Core.address);

        assertBn.equal(ethers.constants.MaxUint256, perpAllowance);
        assertBn.equal(ethers.constants.MaxUint256, coreAllowance);
        assertBn.equal(configuredCollateral.maxAllowable, newMaxAllowables[idx]);
      }

      await assertEvent(
        tx,
        `CollateralConfigured("${await from.getAddress()}", ${newCollaterals.length})`,
        PerpMarketProxy
      );
    });

    it('should remove an unsupported collateral when set with new collaterals', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();

      // Set a known set of supported collaterals.
      const supportedCollaterals = collaterals();
      const synthMarketIds1 = [supportedCollaterals[0].synthMarketId(), supportedCollaterals[1].synthMarketId()];
      const maxAllowables1 = [BigNumber.from(1), BigNumber.from(1)];
      await PerpMarketProxy.connect(from).setCollateralConfiguration(synthMarketIds1, maxAllowables1);

      // Reconfigure the collaterals, removing one of them.
      const synthMarketIds2 = [
        supportedCollaterals[0].synthMarketId(),
        // supportedCollaterals[1].synthMarketId(), (removed!)
      ];
      const maxAllowables2 = [BigNumber.from(1)];
      await PerpMarketProxy.connect(from).setCollateralConfiguration(synthMarketIds2, maxAllowables2);

      const configuredCollaterals = await PerpMarketProxy.getConfiguredCollaterals();
      assert.equal(configuredCollaterals.length, 1);
      assert.equal(
        configuredCollaterals.filter((c) => c.synthMarketId.eq(supportedCollaterals[1].synthMarketId())).length,
        0
      );
    });

    it('should allow zero maxAllowables to temporarily disable deposits', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();

      // Set zero allowable deposits.
      const supportedCollaterals = collaterals();
      const synthMarketIds = [supportedCollaterals[0].synthMarketId(), supportedCollaterals[1].synthMarketId()];
      const maxAllowables = [BigNumber.from(0), BigNumber.from(0)];
      await PerpMarketProxy.connect(from).setCollateralConfiguration(synthMarketIds, maxAllowables);

      // Depositing should cause a failure.
      const { market, trader, collateral, collateralDepositAmount } = await mintAndApproveWithTrader(bs, genTrader(bs));

      // Perform the deposit (maxAllowable = 0 and unsupported are indistinguishable without more information).
      await assertRevert(
        PerpMarketProxy.connect(trader.signer).modifyCollateral(
          trader.accountId,
          market.marketId(),
          collateral.synthMarketId(),
          collateralDepositAmount
        ),
        `UnsupportedCollateral("${collateral.synthMarketId()}")`
      );
    });

    it('should reset existing collaterals when new config is empty', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();

      await PerpMarketProxy.connect(from).setCollateralConfiguration([], []);
      const collaterals = await PerpMarketProxy.getConfiguredCollaterals();

      assert.equal(collaterals.length, 0);
    });

    it('should revert when non-owners configuring collateral', async () => {
      const { PerpMarketProxy } = systems();
      const from = await traders()[0].signer.getAddress();
      await assertRevert(PerpMarketProxy.connect(from).setCollateralConfiguration([], []), `Unauthorized("${from}")`);
    });

    it('should revert when max allowable is negative', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();
      await assertRevert(
        PerpMarketProxy.connect(from).setCollateralConfiguration([bn(genNumber())], [bn(-1)]),
        'Error: value out-of-bounds'
      );
    });

    it('should revert when an invalid synthMarketId is supplied as collateral', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();

      const synthMarketIds = [BigNumber.from(696969)];
      const maxAllowables = [BigNumber.from(1)];

      await assertRevert(
        PerpMarketProxy.connect(from).setCollateralConfiguration(synthMarketIds, maxAllowables),
        `transaction reverted in contract unknown: 0x`
      );
    });

    it('should revoke/approve collateral with 0/maxUint');
  });

  describe('getCollateralUsd', () => {
    it('should return the usd amount in collateral', async () => {
      const { PerpMarketProxy } = systems();
      const { trader, marketId, marginUsdDepositAmount } = await depositMargin(bs, genTrader(bs));

      assertBn.near(await PerpMarketProxy.getCollateralUsd(trader.accountId, marketId), marginUsdDepositAmount);
    });

    it('should return usd amount after price of collateral changes', async () => {
      const { PerpMarketProxy, SpotMarket } = systems();

      // We can't use sUSD here because it should alwyas be 1 within the system.
      const collateral = genOneOf(collateralsWithoutSusd());

      const { trader, marketId, marginUsdDepositAmount, collateralPrice, collateralDepositAmount } =
        await depositMargin(bs, genTrader(bs, { desiredCollateral: collateral }));

      assertBn.near(await PerpMarketProxy.getCollateralUsd(trader.accountId, marketId), marginUsdDepositAmount);

      // Change price.
      await collateral.setPrice(wei(2).mul(collateralPrice).toBN());
      const actual = await PerpMarketProxy.getCollateralUsd(trader.accountId, marketId);

      // Fetch the price of the synth, this is our expected collateral value.
      const { returnAmount: expected } = await SpotMarket.quoteSellExactIn(
        collateral.synthMarketId(),
        collateralDepositAmount
      );

      assertBn.equal(actual, expected);
    });

    it('should return zero when collateral has not been deposited', async () => {
      const { PerpMarketProxy } = systems();
      const { trader, marketId } = await genTrader(bs);

      assertBn.isZero(await PerpMarketProxy.getCollateralUsd(trader.accountId, marketId));
    });

    it('should revert when accountId does not exist', async () => {
      const { PerpMarketProxy } = systems();
      const { marketId } = await genTrader(bs);
      const invalidAccountId = 42069;

      await assertRevert(
        PerpMarketProxy.getCollateralUsd(invalidAccountId, marketId),
        `AccountNotFound("${invalidAccountId}")`,
        PerpMarketProxy
      );
    });

    it('should revert when marketId does not exist', async () => {
      const { PerpMarketProxy } = systems();
      const { trader } = await genTrader(bs);
      const invalidMarketId = 42069;

      await assertRevert(
        PerpMarketProxy.getCollateralUsd(trader.accountId, invalidMarketId),
        `MarketNotFound("${invalidMarketId}")`,
        PerpMarketProxy
      );
    });
  });

  describe('getMarginUsd', () => {
    it('should return marginUsd that reflects value of collateral when no positions opened', async () => {
      const { PerpMarketProxy } = systems();
      const { trader, marketId, collateralDepositAmount, collateralPrice } = await depositMargin(bs, genTrader(bs));

      const marginUsd = await PerpMarketProxy.getMarginUsd(trader.accountId, marketId);

      assertBn.equal(marginUsd, wei(collateralDepositAmount).mul(collateralPrice).toBN());
    });

    it('should return zero marginUsd when no collateral has been deposited', async () => {
      const { PerpMarketProxy } = systems();
      const { trader, marketId } = await genTrader(bs);
      assertBn.isZero(await PerpMarketProxy.getMarginUsd(trader.accountId, marketId));
    });

    it('should return marginUsd + pnl of position', async () => {
      const { PerpMarketProxy } = systems();
      const { trader, marketId, collateral, market, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, { desiredLeverage: 1.1 });

      const { receipt } = await commitAndSettle(bs, marketId, trader, order);
      const settleEvent = findEventSafe({
        receipt,
        eventName: 'OrderSettled',
        contract: PerpMarketProxy,
      });
      const keeperFee = settleEvent?.args.keeperFee as BigNumber;
      const marginUsdBeforePriceChange = await PerpMarketProxy.getMarginUsd(trader.accountId, marketId);

      const pnl = calcPnl(order.sizeDelta, order.oraclePrice, order.fillPrice);
      const expectedMarginUsdBeforePriceChange = wei(order.marginUsd)
        .sub(order.orderFee)
        .sub(keeperFee)
        .add(order.keeperFeeBufferUsd)
        .add(pnl);

      // Assert margin before price change
      assertBn.near(marginUsdBeforePriceChange, expectedMarginUsdBeforePriceChange.toBN(), wei(0.000001).toBN());
      // Change the price, this might lead to profit or loss, depending the the generated order is long or short
      const newPrice = wei(order.oraclePrice).mul(1.5).toBN();
      // Update price
      await market.aggregator().mockSetCurrentPrice(newPrice);

      // Collect some data for expected margin calculation
      const { accruedFunding } = await PerpMarketProxy.getPositionDigest(trader.accountId, marketId);
      const newPnl = calcPnl(order.sizeDelta, newPrice, order.fillPrice);

      const marginUsdAfterPriceChange = await PerpMarketProxy.getMarginUsd(trader.accountId, marketId);

      // Calculate expected margin
      const expectedMarginUsdAfterPriceChange = wei(order.marginUsd)
        .sub(order.orderFee)
        .sub(keeperFee)
        .add(order.keeperFeeBufferUsd)
        .add(newPnl)
        .add(accruedFunding);

      // Assert marginUSD after price update.
      assertBn.near(marginUsdAfterPriceChange, expectedMarginUsdAfterPriceChange.toBN(), wei(0.000001).toBN());
    });

    it('should return 0 for underwater position not yet flagged', async () => {
      const { PerpMarketProxy } = systems();
      const { trader, marketId, collateral, market, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 2,
        desiredSide: -1,
      });

      await commitAndSettle(bs, marketId, trader, order);

      const marginUsdBeforePriceChange = await PerpMarketProxy.getMarginUsd(trader.accountId, marketId);
      assertBn.gt(marginUsdBeforePriceChange, 0);

      // Price double, causing our short to be underwater
      const newPrice = wei(order.oraclePrice).mul(2).toBN();

      // Update price
      await market.aggregator().mockSetCurrentPrice(newPrice);

      // Load margin again
      const marginUsdAfterPriceChange = await PerpMarketProxy.getMarginUsd(trader.accountId, marketId);

      // Assert marginUSD is 0 since price change made the position underwater
      assertBn.isZero(marginUsdAfterPriceChange);
    });

    it('should not consider a position in a different market for the same account', async () => {
      const { PerpMarketProxy } = systems();

      const { marketId, trader, collateralDepositAmount, collateralPrice } = await depositMargin(
        bs,
        genTrader(bs, { desiredMarket: bs.markets()[0] })
      );
      // Deposit margin to another market
      const otherDeposit = await depositMargin(
        bs,
        genTrader(bs, { desiredMarket: bs.markets()[1], desiredTrader: trader })
      );
      const marginBeforeTradeOnDiffMarket = await PerpMarketProxy.getMarginUsd(trader.accountId, marketId);

      assertBn.equal(marginBeforeTradeOnDiffMarket, wei(collateralDepositAmount).mul(collateralPrice).toBN());

      // Generate and execute an order for the other market
      const order = await genOrder(
        bs,
        otherDeposit.market,
        otherDeposit.collateral,
        otherDeposit.collateralDepositAmount
      );
      await commitAndSettle(bs, otherDeposit.marketId, otherDeposit.trader, order);

      // Assert that collateral is still the same.
      const marginAfterTradeOnDiffMarket = await PerpMarketProxy.getMarginUsd(trader.accountId, marketId);

      // Margin should stay unchanged.
      assertBn.equal(marginBeforeTradeOnDiffMarket, marginAfterTradeOnDiffMarket);
    });

    it('should reflect collateral price changes', async () => {
      const { PerpMarketProxy } = systems();

      const collateral = genOneOf(collateralsWithoutSusd());
      const { trader, marketId, collateralDepositAmount, collateralPrice } = await depositMargin(
        bs,
        genTrader(bs, { desiredCollateral: collateral })
      );

      const marginUsdBeforePriceChange = await PerpMarketProxy.getMarginUsd(trader.accountId, marketId);

      assertBn.equal(marginUsdBeforePriceChange, wei(collateralDepositAmount).mul(collateralPrice).toBN());

      const newPrice = wei(collateralPrice)
        .mul(genOneOf([1.1, 0.9]))
        .toBN();
      await collateral.setPrice(newPrice);

      const marginUsdAfterPriceChange = await PerpMarketProxy.getMarginUsd(trader.accountId, marketId);
      assertBn.equal(marginUsdAfterPriceChange, wei(collateralDepositAmount).mul(newPrice).toBN());
    });

    it('should revert when accountId does not exist', async () => {
      const { PerpMarketProxy } = systems();
      const { marketId } = await genTrader(bs);
      const invalidAccountId = bn(genNumber(42069, 50_000));

      // Perform withdraw with invalid market
      await assertRevert(
        PerpMarketProxy.getMarginUsd(invalidAccountId, marketId),
        `AccountNotFound("${invalidAccountId}")`,
        PerpMarketProxy
      );
    });

    it('should revert when marketId does not exist', async () => {
      const { PerpMarketProxy } = systems();
      const { trader } = await genTrader(bs);
      const invalidMarketId = bn(genNumber(42069, 50_000));

      // Perform withdraw with invalid market
      await assertRevert(
        PerpMarketProxy.getMarginUsd(trader.accountId, invalidMarketId),
        `MarketNotFound("${invalidMarketId}")`,
        PerpMarketProxy
      );
    });
  });
});
