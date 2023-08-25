import { Contract, ethers, utils } from 'ethers';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { wei } from '@synthetixio/wei';
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
import {
  ZERO_ADDRESS,
  approveAndMintMargin,
  commitAndSettle,
  commitOrder,
  depositMargin,
  extendContractAbi,
} from '../../helpers';
import { calcPnl } from '../../calculations';
import { CollateralMock } from '../../../typechain-types';
import { assertEvents } from '../../assert';

describe('MarginModule', async () => {
  const bs = bootstrap(genBootstrap());
  const { markets, collaterals, traders, owner, systems, restore } = bs;

  beforeEach(restore);

  describe('modifyCollateral', () => {
    it('should revert when a transfer amount of 0', async () => {
      const { PerpMarketProxy } = systems();

      const trader = genOneOf(traders());
      const market = genOneOf(markets());
      const collateral = genOneOf(collaterals()).contract.connect(trader.signer);
      const amountDelta = bn(0);

      await assertRevert(
        PerpMarketProxy.connect(trader.signer).modifyCollateral(
          trader.accountId,
          market.marketId(),
          collateral.address,
          amountDelta
        ),
        `ZeroAmount()`
      );
    });

    it('should recompute funding', async () => {
      const { PerpMarketProxy } = systems();
      const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));

      // Create a new position.
      await commitAndSettle(bs, marketId, trader, await genOrder(bs, market, collateral, collateralDepositAmount));

      // Provision collateral and approve for access.
      const { collateralDepositAmount: collateralDepositAmount2 } = await approveAndMintMargin(
        bs,
        genTrader(bs, { desiredMarket: market, desiredTrader: trader, desiredCollateral: collateral })
      );

      // Perform the deposit.
      const tx = await PerpMarketProxy.connect(trader.signer).modifyCollateral(
        trader.accountId,
        market.marketId(),
        collateral.contract.address,
        collateralDepositAmount2
      );
      await assertEvent(tx, `FundingRecomputed`, PerpMarketProxy);
    });

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
        await assertEvent(
          tx,
          `MarginDeposit("${traderAddress}", "${PerpMarketProxy.address}", ${amountDelta}, "${collateral.address}")`,
          PerpMarketProxy
        );

        const expectedBalanceAfter = balanceBefore.sub(amountDelta);
        assertBn.equal(await collateral.balanceOf(traderAddress), expectedBalanceAfter);
      });

      it('should emit depositMarketUsd when using sUSD as collateral'); // To write this test we need to configure `globalConfig.usdToken` as collateral in bootstrap.

      it('should emit all events in correct order', async () => {
        const { PerpMarketProxy, Core } = systems();
        const traderObj = await genTrader(bs);
        await approveAndMintMargin(bs, traderObj);
        const { collateral, trader, traderAddress, collateralDepositAmount, marketId } = traderObj;
        const { accountId, signer } = trader;
        // Perform the deposit.
        const tx = await PerpMarketProxy.connect(signer).modifyCollateral(
          accountId,
          marketId,
          collateral.contract.address,
          collateralDepositAmount
        );
        // Create a contract that can parse all events emitted
        const contractsWithAllEvents = extendContractAbi(
          PerpMarketProxy,
          Core.interface
            .format(utils.FormatTypes.full)
            .concat(['event Transfer(address indexed from, address indexed to, uint256 value)'])
        );

        await assertEvents(
          tx,
          [
            /FundingRecomputed/,
            `Transfer("${traderAddress}", "${PerpMarketProxy.address}", ${collateralDepositAmount})`, // from collateral ERC20 contract
            `Transfer("${PerpMarketProxy.address}", "${Core.address}", ${collateralDepositAmount})`, // from collateral ERC20 contract
            `MarketCollateralDeposited(${marketId}, "${collateral.contract.address}", ${collateralDepositAmount}, "${PerpMarketProxy.address}")`, // from core
            `MarginDeposit("${traderAddress}", "${PerpMarketProxy.address}", ${collateralDepositAmount}, "${collateral.contract.address}")`,
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
        // open leveraged position
        await commitAndSettle(bs, marketId, trader, Promise.resolve(order));
        // updating price, causing position to be liquidatable
        await market.aggregator().mockSetCurrentPrice(wei(order.oraclePrice).mul(2).toBN());
        // flag position
        await PerpMarketProxy.flagPosition(trader.accountId, marketId);
        // Mint some more collateral
        await collateral.contract.connect(trader.signer).mint(trader.signer.getAddress(), collateralDepositAmount);
        await collateral.contract.connect(trader.signer).approve(PerpMarketProxy.address, collateralDepositAmount);

        await assertRevert(
          PerpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            marketId,
            collateral.contract.address,
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
          collateral.contract.address,
          withdrawAmount.mul(-1)
        );
        // Create a contract that can parse all events emitted
        const contractsWithAllEvents = extendContractAbi(
          PerpMarketProxy,
          Core.interface
            .format(utils.FormatTypes.full)
            .concat(['event Transfer(address indexed from, address indexed to, uint256 value)'])
        );
        await assertEvents(
          tx,
          [
            /FundingRecomputed/,
            `Transfer("${Core.address}", "${PerpMarketProxy.address}", ${withdrawAmount})`, // from collateral ERC20 contract
            `MarketCollateralWithdrawn(${marketId}, "${collateral.contract.address}", ${withdrawAmount}, "${PerpMarketProxy.address}")`, // from core
            `Transfer("${PerpMarketProxy.address}", "${traderAddress}", ${withdrawAmount})`, // from collateral ERC20 contract
            `MarginWithdraw("${PerpMarketProxy.address}", "${traderAddress}", ${withdrawAmount}, "${collateral.contract.address}")`,
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

      it('should allow partial withdraw when initial margin req are still met', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId, market, collateral, collateralDepositAmount, collateralPrice, traderAddress } =
          await depositMargin(bs, genTrader(bs));
        const collateralAddress = collateral.contract.address;

        // open leveraged position
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
        // Figure out max withdraw
        const maxWithdrawUsd = wei(remainingMarginUsd).sub(im);
        const maxWithdraw = maxWithdrawUsd.div(collateralPrice);
        // Withdraw 90% of max withdraw
        const withdrawAmount = maxWithdraw.mul(0.9);
        // Store balance to compare later
        const balanceBefore = await collateral.contract.balanceOf(traderAddress);

        const tx = await PerpMarketProxy.connect(trader.signer).modifyCollateral(
          trader.accountId,
          marketId,
          collateral.contract.address,
          withdrawAmount.mul(-1).toBN()
        );
        await assertEvent(
          tx,
          `MarginWithdraw("${
            PerpMarketProxy.address
          }", "${traderAddress}", ${withdrawAmount.toBN()}, "${collateralAddress}")`,
          PerpMarketProxy
        );
        const expectedBalanceAfter = wei(balanceBefore).add(withdrawAmount).toBN();
        const balanceAfter = await collateral.contract.balanceOf(traderAddress);
        assertBn.equal(expectedBalanceAfter, balanceAfter);
      });

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
        // open leveraged position
        await commitAndSettle(bs, marketId, trader, Promise.resolve(order));

        const { im, remainingMarginUsd } = await PerpMarketProxy.getPositionDigest(trader.accountId, marketId);
        const maxWithdrawUsd = wei(remainingMarginUsd).sub(im);

        // Try withdrawing $1 more than max withdraw
        const amountToWithdrawUsd = maxWithdrawUsd.add(1);
        // Convert to native units
        const amountToWithdraw = amountToWithdrawUsd.div(collateralPrice);

        await assertRevert(
          PerpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            marketId,
            collateral.contract.address,
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
        // open leveraged position
        await commitAndSettle(bs, marketId, trader, Promise.resolve(order));

        await assertRevert(
          PerpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            marketId,
            collateral.contract.address,
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
        // open leveraged position
        await commitAndSettle(bs, marketId, trader, Promise.resolve(order));
        // Change market price to make position liquidatable
        await market.aggregator().mockSetCurrentPrice(wei(order.oraclePrice).mul(2).toBN());

        await assertRevert(
          PerpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            marketId,
            collateral.contract.address,
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
        // open leveraged position
        await commitAndSettle(bs, marketId, trader, Promise.resolve(order));
        // updating price, causing position to be liquidatable
        await market.aggregator().mockSetCurrentPrice(wei(order.oraclePrice).mul(2).toBN());
        // flag position
        await PerpMarketProxy.flagPosition(trader.accountId, marketId);

        await assertRevert(
          PerpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            marketId,
            collateral.contract.address,
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
      it('should recompute funding', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs)
        );

        // Perform the deposit.
        const tx = await PerpMarketProxy.connect(trader.signer).withdrawAllCollateral(
          trader.accountId,
          market.marketId()
        );
        await assertEvent(tx, `FundingRecomputed()`, PerpMarketProxy);
      });

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
        // open leveraged position
        await commitAndSettle(bs, marketId, trader, Promise.resolve(order));
        // updating price, causing position to be liquidatable
        await market.aggregator().mockSetCurrentPrice(wei(order.oraclePrice).mul(2).toBN());
        // flag position
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

      for (const [i, collateral] of Object.entries(collaterals)) {
        const index = parseInt(i);
        const { maxAllowable, collateralType, oracleNodeId } = collateral;
        const collateralContract = new Contract(
          collateralType,
          ['function allowance(address, address) view returns (uint256)'],
          bs.provider()
        ) as CollateralMock;
        const perpsAllowance = await collateralContract.allowance(PerpMarketProxy.address, PerpMarketProxy.address);
        const coreAllowance = await collateralContract.allowance(PerpMarketProxy.address, bs.systems().Core.address);

        assertBn.equal(ethers.constants.MaxUint256, perpsAllowance);
        assertBn.equal(ethers.constants.MaxUint256, coreAllowance);
        assertBn.equal(maxAllowable, maxAllowables[index]);
        assert.equal(collateralType, collateralTypes[index]);
        assert.equal(oracleNodeId, oracleNodeIds[index]);
      }

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

    it('should revoke/approve collateral with 0/maxUint');
  });

  describe('getCollateralUsd', () => {
    it('should return correct usd amount in collateral', async () => {
      const { PerpMarketProxy } = systems();
      const { trader, marketId, marginUsdDepositAmount } = await depositMargin(bs, genTrader(bs));

      assertBn.near(await PerpMarketProxy.getCollateralUsd(trader.accountId, marketId), marginUsdDepositAmount);
    });

    it('should return correct usd amount after price of collateral changes', async () => {
      const { PerpMarketProxy } = systems();
      const { trader, marketId, marginUsdDepositAmount, collateral, collateralPrice } = await depositMargin(
        bs,
        genTrader(bs)
      );

      assertBn.near(await PerpMarketProxy.getCollateralUsd(trader.accountId, marketId), marginUsdDepositAmount);

      // Change price
      await collateral.aggregator().mockSetCurrentPrice(wei(2).mul(collateralPrice).toBN());

      assertBn.near(
        await PerpMarketProxy.getCollateralUsd(trader.accountId, marketId),
        wei(marginUsdDepositAmount).mul(2).toBN()
      );
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
      assertBn.equal(await PerpMarketProxy.getMarginUsd(trader.accountId, marketId), bn(0));
    });

    it('should return marginUsd + pnl of position', async () => {
      const { PerpMarketProxy } = systems();
      const { trader, marketId, collateral, market, collateralDepositAmount } = await depositMargin(bs, genTrader(bs));
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, { desiredLeverage: 1.1 });

      await commitAndSettle(bs, marketId, trader, order);

      const marginUsdBeforePriceChange = await PerpMarketProxy.getMarginUsd(trader.accountId, marketId);

      const pnl = calcPnl(order.sizeDelta, order.oraclePrice, order.fillPrice);
      const expectedMarginUsdBeforePriceChange = wei(order.marginUsd)
        .sub(order.orderFee)
        .sub(order.keeperFee)
        .add(order.keeperFeeBufferUsd)
        .add(pnl);
      // Assert margin before price change
      assertBn.equal(marginUsdBeforePriceChange, expectedMarginUsdBeforePriceChange.toBN());
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
        .sub(order.keeperFee)
        .add(order.keeperFeeBufferUsd)
        .add(newPnl)
        .add(accruedFunding);
      // Assert marginUSD after price update
      assertBn.equal(marginUsdAfterPriceChange, expectedMarginUsdAfterPriceChange.toBN());
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

      const pnl = calcPnl(order.sizeDelta, order.oraclePrice, order.fillPrice);
      const expectedMarginUsdBeforePriceChange = wei(order.marginUsd)
        .sub(order.orderFee)
        .sub(order.keeperFee)
        .add(order.keeperFeeBufferUsd)
        .add(pnl);
      // Assert margin before price change
      assertBn.equal(marginUsdBeforePriceChange, expectedMarginUsdBeforePriceChange.toBN());
      // Change the price, this might lead to profit or loss, depending the the generated order is long or short
      const newPrice = wei(order.oraclePrice).mul(2).toBN();
      // Update price
      await market.aggregator().mockSetCurrentPrice(newPrice);

      // load margin again
      const marginUsdAfterPriceChange = await PerpMarketProxy.getMarginUsd(trader.accountId, marketId);
      // Assert marginUSD is 0 since price change made the position underwater
      assertBn.equal(marginUsdAfterPriceChange, bn(0));
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

      // Assert that collateral is still the same
      const marginAfterTradeOnDiffMarket = await PerpMarketProxy.getMarginUsd(trader.accountId, marketId);
      // Margin should stay unchanged
      assertBn.equal(marginBeforeTradeOnDiffMarket, marginAfterTradeOnDiffMarket);
    });

    it('should reflect collateral price changes', async () => {
      const { PerpMarketProxy } = systems();
      const { trader, marketId, collateral, collateralDepositAmount, collateralPrice } = await depositMargin(
        bs,
        genTrader(bs)
      );

      const marginUsdBeforePriceChange = await PerpMarketProxy.getMarginUsd(trader.accountId, marketId);

      assertBn.equal(marginUsdBeforePriceChange, wei(collateralDepositAmount).mul(collateralPrice).toBN());

      const newPrice = wei(collateralPrice)
        .mul(genOneOf([1.1, 0.9]))
        .toBN();
      await collateral.aggregator().mockSetCurrentPrice(newPrice);

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
