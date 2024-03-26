import { BigNumber, ethers, utils } from 'ethers';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { wei } from '@synthetixio/wei';
import assert from 'assert';
import { shuffle } from 'lodash';
import forEach from 'mocha-each';
import { PerpCollateral, bootstrap } from '../../bootstrap';
import {
  bn,
  genBootstrap,
  genNumber,
  genListOf,
  genOneOf,
  genTrader,
  genOrder,
  toRoundRobinGenerators,
  genBytes32,
  genAddress,
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
  ADDRESS0,
  withExplicitEvmMine,
  getSusdCollateral,
  isSusdCollateral,
  SYNTHETIX_USD_MARKET_ID,
  findOrThrow,
  setMarketConfiguration,
  SECONDS_ONE_DAY,
  setMarketConfigurationById,
  payDebt,
  getFastForwardTimestamp,
} from '../../helpers';
import { calcDiscountedCollateralPrice, calcPricePnl } from '../../calculations';
import { assertEvents } from '../../assert';

describe('MarginModule', async () => {
  const bs = bootstrap(genBootstrap());
  const {
    markets,
    collaterals,
    collateralsWithoutSusd,
    spotMarket,
    traders,
    owner,
    systems,
    provider,
    restore,
  } = bs;

  beforeEach(restore);

  describe('modifyCollateral', () => {
    it('should revert when modifying if expired order exists', async () => {
      const { PerpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

      // Commit an order for this trader.
      await commitOrder(bs, marketId, trader, order);

      // Verify that an order exists.
      const pendingOrder = await PerpMarketProxy.getOrderDigest(trader.accountId, marketId);
      assertBn.equal(pendingOrder.sizeDelta, order.sizeDelta);

      // Fastforward to expire the pending order.
      const { maxOrderAge } = await PerpMarketProxy.getMarketConfiguration();
      await fastForwardBySec(provider(), maxOrderAge.toNumber() + 1);

      await assertRevert(
        PerpMarketProxy.connect(trader.signer).modifyCollateral(
          trader.accountId,
          marketId,
          collateral.synthMarketId(),
          collateralDepositAmount.mul(-1)
        ),
        `OrderFound()`,
        PerpMarketProxy
      );
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
        `ZeroAmount()`,
        PerpMarketProxy
      );
    });

    it('should recompute funding', async () => {
      const { PerpMarketProxy } = systems();
      const { trader, marketId, market, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );

      // Create a new position.
      await commitAndSettle(
        bs,
        marketId,
        trader,
        genOrder(bs, market, collateral, collateralDepositAmount)
      );

      // Provision collateral and approve for access.
      const { collateralDepositAmount: collateralDepositAmount2 } = await mintAndApproveWithTrader(
        bs,
        genTrader(bs, {
          desiredMarket: market,
          desiredTrader: trader,
          desiredCollateral: collateral,
        })
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

      const { market, collateral, collateralDepositAmount, marketId, trader } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

      // Commit an order for this trader.
      await commitOrder(bs, marketId, trader, order);

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
        `OrderFound()`,
        PerpMarketProxy
      );

      // (withdraw) Attempt to withdraw previously deposited margin but expect fail.
      await assertRevert(
        PerpMarketProxy.connect(trader.signer).modifyCollateral(
          trader.accountId,
          marketId,
          collateral.synthMarketId(),
          collateralDepositAmount.mul(-1)
        ),
        `OrderFound()`,
        PerpMarketProxy
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
      } = await mintAndApproveWithTrader(
        bs,
        genTrader(bs, { desiredTrader: tradersGenerator.next().value })
      );

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
        `PermissionDenied("${trader1.accountId}", "${permission}", "${signerAddress}")`,
        PerpMarketProxy
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
        await assertEvent(
          receipt,
          `MarginDeposit(${marginDepositEventProperties})`,
          PerpMarketProxy
        );

        const expectedBalanceAfter = balanceBefore.sub(amountDelta);
        assertBn.equal(await collateral.contract.balanceOf(traderAddress), expectedBalanceAfter);
      });

      it('should allow deposit of collateral when collateral maxMarketSize is 0', async () => {
        const { PerpMarketProxy } = systems();

        const { collateral, collateralDepositAmount, trader, market } = await depositMargin(
          bs,
          genTrader(bs)
        );

        await setMarketConfigurationById(bs, market.marketId(), { maxMarketSize: bn(0) });
        const { maxMarketSize } = await PerpMarketProxy.getMarketConfigurationById(
          market.marketId()
        );
        assertBn.equal(maxMarketSize, bn(0));

        await mintAndApprove(bs, collateral, collateralDepositAmount, trader.signer);

        // Should also be able to deposit.
        const { receipt: depositReceipt } = await withExplicitEvmMine(
          () =>
            PerpMarketProxy.connect(trader.signer).modifyCollateral(
              trader.accountId,
              market.marketId(),
              collateral.synthMarketId(),
              collateralDepositAmount
            ),
          provider()
        );

        await assertEvent(depositReceipt, 'MarginDeposit', PerpMarketProxy);
      });

      forEach([
        ['sUSD', () => getSusdCollateral(collaterals())],
        ['non-sUSD', () => genOneOf(collateralsWithoutSusd())],
      ]).it(
        'should emit all events in correct order (%s)',
        async (_, getCollateral: () => PerpCollateral) => {
          const { PerpMarketProxy, Core } = systems();

          const { collateral, trader, traderAddress, collateralDepositAmount, marketId } =
            await mintAndApproveWithTrader(
              bs,
              await genTrader(bs, { desiredCollateral: getCollateral() })
            );

          // Perform the deposit.
          const { receipt } = await withExplicitEvmMine(
            () =>
              PerpMarketProxy.connect(trader.signer).modifyCollateral(
                trader.accountId,
                marketId,
                collateral.synthMarketId(),
                collateralDepositAmount
              ),
            provider()
          );

          // Create a contract that can parse all events emitted.
          const contractsWithAllEvents = extendContractAbi(
            PerpMarketProxy,
            Core.interface
              .format(utils.FormatTypes.full)
              .concat(['event Transfer(address indexed from, address indexed to, uint256 value)'])
          );

          const marginDepositEventProperties = [
            `"${traderAddress}"`,
            `"${PerpMarketProxy.address}"`,
            collateralDepositAmount,
            collateral.synthMarketId(),
          ].join(', ');

          if (isSusdCollateral(collateral)) {
            await assertEvents(
              receipt,
              [
                /FundingRecomputed/,
                /UtilizationRecomputed/,
                `Transfer("${traderAddress}", "${ADDRESS0}", ${collateralDepositAmount})`,
                new RegExp(
                  `MarketUsdDeposited\\(${marketId}, "${traderAddress}", ${collateralDepositAmount}, "${PerpMarketProxy.address}",`
                ), // + tail properties omitted
                `MarginDeposit(${marginDepositEventProperties})`,
              ],
              contractsWithAllEvents
            );
          } else {
            const marketCollateralDepositedEventProperties = [
              marketId,
              `"${collateral.synthAddress()}"`,
              collateralDepositAmount,
              `"${PerpMarketProxy.address}"`,
            ].join(', ');
            await assertEvents(
              receipt,
              [
                /FundingRecomputed/,
                /UtilizationRecomputed/,
                `Transfer("${traderAddress}", "${PerpMarketProxy.address}", ${collateralDepositAmount})`, // From collateral ERC20 contract
                `Transfer("${PerpMarketProxy.address}", "${Core.address}", ${collateralDepositAmount})`, // From collateral ERC20 contract
                new RegExp(
                  `MarketCollateralDeposited\\(${marketCollateralDepositedEventProperties},`
                ), // From core (+ tail properties omitted)
                `MarginDeposit(${marginDepositEventProperties})`,
              ],
              contractsWithAllEvents
            );
          }
        }
      );

      it('should affect an existing position when depositing', async () => {
        const { PerpMarketProxy } = systems();

        const gTrader = genTrader(bs);
        const { trader, marketId, market, collateral, collateralDepositAmount } =
          await depositMargin(bs, gTrader);
        const order = await genOrder(bs, market, collateral, collateralDepositAmount);
        const { accountId } = trader;

        await setMarketConfiguration(bs, {
          maxCollateralDiscount: bn(0),
          minCollateralDiscount: bn(0),
        });

        // Create a new position.
        await commitAndSettle(bs, marketId, trader, order);

        // Verify this position has been created successfully.
        const positionDigest = await PerpMarketProxy.getPositionDigest(accountId, marketId);
        assertBn.equal(positionDigest.size, order.sizeDelta);

        // Get predeposit collateralUsd.
        const { collateralUsd: collateralUsd1 } = await PerpMarketProxy.getMarginDigest(
          accountId,
          marketId
        );

        // Deposit more margin, verify, and get post deposit collateralUsd.
        const deposit2 = await depositMargin(bs, gTrader);
        const { collateralUsd: collateralUsd2 } = await PerpMarketProxy.getMarginDigest(
          accountId,
          marketId
        );

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
          `PermissionDenied("${invalidAccountId}"`,
          PerpMarketProxy
        );
      });

      it('should revert depositing to a market that does not exist', async () => {
        const { PerpMarketProxy } = systems();

        const gTrader = genTrader(bs);
        const { trader, collateral, collateralDepositAmount } = await mintAndApproveWithTrader(
          bs,
          gTrader
        );
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
          `UnsupportedCollateral("${invalidSynthMarketId}")`,
          PerpMarketProxy
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
          `MaxCollateralExceeded("${depositAmountDelta}", "${collateral.max}")`,
          PerpMarketProxy
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
          `MaxCollateralExceeded("${depositAmountDelta2}", "${collateral.max}")`,
          PerpMarketProxy
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
          `InsufficientAllowance("${amountToDeposit}", "${amountAvailable}")`,
          collateral.contract
        );
      });

      it('should revert when account is flagged for liquidation', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId, market, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));
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
        const { trader, traderAddress, marketId, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));

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

        await assertEvent(
          receipt,
          `MarginWithdraw(${marginWithdrawEventProperties})`,
          PerpMarketProxy
        );
      });

      it('should allow withdraw of collateral when collateral maxAllowable is 0', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, traderAddress, marketId, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));
        const configuredCollaterals = await PerpMarketProxy.getMarginCollateralConfiguration();

        await PerpMarketProxy.setMarginCollateralConfiguration(
          configuredCollaterals.map(({ synthMarketId }) => synthMarketId),
          configuredCollaterals.map(({ oracleNodeId }) => oracleNodeId),
          // Set maxAllowable to 0 for all collaterals
          configuredCollaterals.map(() => bn(0)),
          configuredCollaterals.map(({ rewardDistributor }) => rewardDistributor)
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

        await assertEvent(
          receipt,
          `MarginWithdraw(${marginWithdrawEventProperties})`,
          PerpMarketProxy
        );
      });

      it('should allow withdraw when market is in close only', async () => {
        const { PerpMarketProxy } = systems();
        const { collateral, trader, marketId, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs)
        );

        await setMarketConfigurationById(bs, marketId, { maxMarketSize: 0 });
        const { maxMarketSize } = await PerpMarketProxy.getMarketConfigurationById(marketId);
        assertBn.equal(maxMarketSize, bn(0));

        const { receipt: withdrawReceipt } = await withExplicitEvmMine(
          () =>
            PerpMarketProxy.connect(trader.signer).modifyCollateral(
              trader.accountId,
              marketId,
              collateral.synthMarketId(),
              collateralDepositAmount.mul(-1)
            ),
          provider()
        );

        await assertEvent(withdrawReceipt, 'MarginWithdraw', PerpMarketProxy);
      });

      forEach([
        ['sUSD', () => getSusdCollateral(collaterals())],
        ['non-sUSD', () => genOneOf(collateralsWithoutSusd())],
      ]).it(
        'should emit all events in correct order (%s)',
        async (_, getCollateral: () => PerpCollateral) => {
          const { PerpMarketProxy, Core } = systems();
          const { trader, marketId, collateral, collateralDepositAmount, traderAddress } =
            await depositMargin(bs, genTrader(bs, { desiredCollateral: getCollateral() }));
          const withdrawAmount = wei(collateralDepositAmount).mul(0.5).toBN();

          // Perform the withdraw.
          const { receipt } = await withExplicitEvmMine(
            () =>
              PerpMarketProxy.connect(trader.signer).modifyCollateral(
                trader.accountId,
                marketId,
                collateral.synthMarketId(),
                withdrawAmount.mul(-1)
              ),
            provider()
          );

          // Create a contract that can parse all events emitted.
          const contractsWithAllEvents = extendContractAbi(
            PerpMarketProxy,
            Core.interface
              .format(utils.FormatTypes.full)
              .concat(['event Transfer(address indexed from, address indexed to, uint256 value)'])
          );

          let expectedEvents: Array<string | RegExp> = [
            /FundingRecomputed/,
            /UtilizationRecomputed/,
          ];

          if (isSusdCollateral(collateral)) {
            // Both of these events are emitted by the core protocol.
            expectedEvents = expectedEvents.concat([
              `Transfer("${ADDRESS0}", "${traderAddress}", ${withdrawAmount})`,
              new RegExp(
                `MarketUsdWithdrawn\\(${marketId}, "${traderAddress}", ${withdrawAmount}, "${PerpMarketProxy.address}",`
              ), // + tail properties omitted.
            ]);
          } else {
            expectedEvents = expectedEvents.concat([
              `Transfer("${Core.address}", "${PerpMarketProxy.address}", ${withdrawAmount})`, // From collateral ERC20 contract
              new RegExp(
                `MarketCollateralWithdrawn\\(${marketId}, "${collateral.contract.address}", ${withdrawAmount}, "${PerpMarketProxy.address}",`
              ), // From core (+ tail properties omitted)
              `Transfer("${PerpMarketProxy.address}", "${traderAddress}", ${withdrawAmount})`, // From collateral ERC20 contract
            ]);
          }

          const marginWithdrawEventProperties = [
            `"${PerpMarketProxy.address}"`,
            `"${traderAddress}"`,
            withdrawAmount,
            collateral.synthMarketId(),
          ].join(', ');
          expectedEvents.push(`MarginWithdraw(${marginWithdrawEventProperties})`);

          await assertEvents(receipt, expectedEvents, contractsWithAllEvents);
        }
      );

      it('should allow partial withdraw of collateral to my account', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, traderAddress, marketId, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));

        // Perform the withdraw (partial amount).
        const withdrawAmount = collateralDepositAmount.div(2).mul(-1);
        const { receipt } = await withExplicitEvmMine(
          () =>
            PerpMarketProxy.connect(trader.signer).modifyCollateral(
              trader.accountId,
              marketId,
              collateral.synthMarketId(),
              withdrawAmount
            ),
          provider()
        );

        const marginWithdrawEventProperties = [
          `"${PerpMarketProxy.address}"`,
          `"${traderAddress}"`,
          withdrawAmount.abs(), // Convert to positive because `Transfer` takes in abs(amount).
          collateral.synthMarketId(),
        ].join(', ');

        await assertEvent(
          receipt,
          `MarginWithdraw(${marginWithdrawEventProperties})`,
          PerpMarketProxy
        );
      });

      it('should allow partial withdraw when initial margin req are still met', async () => {
        const { PerpMarketProxy } = systems();
        const {
          trader,
          marketId,
          market,
          collateral,
          collateralDepositAmount,
          collateralPrice,
          traderAddress,
        } = await depositMargin(bs, genTrader(bs));

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

        const { im, remainingMarginUsd } = await PerpMarketProxy.getPositionDigest(
          trader.accountId,
          marketId
        );

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
        await assertEvent(
          receipt,
          `MarginWithdraw(${marginWithdrawEventProperties})`,
          PerpMarketProxy
        );

        const expectedBalanceAfter = wei(balanceBefore).add(withdrawAmount).toBN();
        const balanceAfter = await collateral.contract.balanceOf(traderAddress);
        assertBn.equal(expectedBalanceAfter, balanceAfter);
      });

      it('should revert withdraw to an account that does not exist', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId, collateral, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs)
        );
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
        const { trader, collateral, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs)
        );
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
        const { trader, marketId, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs)
        );
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
        const { trader, marketId, collateral, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs)
        );

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
        const { trader, marketId, market, collateral, collateralDepositAmount, collateralPrice } =
          await depositMargin(bs, genTrader(bs));
        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredSide: -1,
          desiredLeverage: 5,
        });

        // `collateralPrice` does not include discount so to make it easier, do the same here. If not, a higher price
        // would mean fewer units to withdraw and hence will stay above im.
        await setMarketConfiguration(bs, {
          minCollateralDiscount: bn(0),
          maxCollateralDiscount: bn(0),
        });

        // Open leveraged position
        await commitAndSettle(bs, marketId, trader, order);

        const { im, remainingMarginUsd } = await PerpMarketProxy.getPositionDigest(
          trader.accountId,
          marketId
        );
        const maxWithdrawUsd = wei(remainingMarginUsd).sub(im);

        // Try withdrawing $1 more than max withdraw in native units.
        const amountToWithdrawUsd = maxWithdrawUsd.add(1);
        const amountToWithdraw = amountToWithdrawUsd.div(collateralPrice);

        /**
         * Error: Transaction was expected to revert with "InsufficientMargin()", but reverted with "CanLiquidatePosition()"
         * Error: transaction reverted in contract MarginModule: CanLiquidatePosition()
         *
         * Need to make sure we are not liquidatable.
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
        const { trader, marketId, market, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));
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
        const { trader, marketId, market, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));
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
            bn(-0.01)
          ),
          `CanLiquidatePosition()`,
          PerpMarketProxy
        );
      });

      it('should revert when account is flagged for liquidation', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId, market, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));
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
        const { trader, traderAddress, marketId, collateralDepositAmount, collateral, market } =
          await depositMargin(
            bs,
            genTrader(bs, { desiredCollateral: collateralGenerator.next().value })
          );

        // Deposit margin with collateral 2
        const { collateralDepositAmount: collateralDepositAmount2, collateral: collateral2 } =
          await depositMargin(
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
        const collateralWalletBalanceBeforeWithdrawal =
          await collateral.contract.balanceOf(traderAddress);
        const collateralWalletBalanceBeforeWithdrawal2 =
          await collateral2.contract.balanceOf(traderAddress);

        // Perform the `withdrawAllCollateral`.
        const { receipt } = await withExplicitEvmMine(
          () =>
            PerpMarketProxy.connect(trader.signer).withdrawAllCollateral(
              trader.accountId,
              marketId
            ),
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
        const accountDigestAfter = await PerpMarketProxy.getAccountDigest(
          trader.accountId,
          marketId
        );
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

      it('should allow withdrawal of collateral when collateral maxAllowable is 0', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, traderAddress, marketId, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));

        const configuredCollaterals = await PerpMarketProxy.getMarginCollateralConfiguration();
        await PerpMarketProxy.setMarginCollateralConfiguration(
          configuredCollaterals.map(({ synthMarketId }) => synthMarketId),
          configuredCollaterals.map(({ oracleNodeId }) => oracleNodeId),
          // Set maxAllowable to 0 for all collaterals.
          configuredCollaterals.map(() => bn(0)),
          configuredCollaterals.map(({ rewardDistributor }) => rewardDistributor)
        );

        // Perform the withdraw (full amount).
        const { receipt } = await withExplicitEvmMine(
          () =>
            PerpMarketProxy.connect(trader.signer).withdrawAllCollateral(
              trader.accountId,
              marketId
            ),
          provider()
        );

        const marginWithdrawEventProperties = [
          `"${PerpMarketProxy.address}"`,
          `"${traderAddress}"`,
          collateralDepositAmount,
          collateral.synthMarketId(),
        ].join(', ');

        await assertEvent(
          receipt,
          `MarginWithdraw(${marginWithdrawEventProperties})`,
          PerpMarketProxy
        );
      });

      it('should allow withdrawing all when market is in close only', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId } = await depositMargin(bs, genTrader(bs));
        await setMarketConfigurationById(bs, marketId, { maxMarketSize: 0 });
        const { maxMarketSize } = await PerpMarketProxy.getMarketConfigurationById(marketId);
        assertBn.equal(maxMarketSize, bn(0));
        // We should be able to withdraw
        const { receipt: withdrawReceipt } = await withExplicitEvmMine(
          () =>
            PerpMarketProxy.connect(trader.signer).withdrawAllCollateral(
              trader.accountId,
              marketId
            ),
          provider()
        );

        await assertEvent(withdrawReceipt, 'MarginWithdraw', PerpMarketProxy);
      });

      it('should revert withdrawingAll if pending order exists and expired', async () => {
        const { PerpMarketProxy } = systems();
        const { collateral, market, marketId, collateralDepositAmount, trader } =
          await depositMargin(bs, genTrader(bs));

        const order = await genOrder(bs, market, collateral, collateralDepositAmount);
        await commitOrder(bs, marketId, trader, order);

        // Make the order expired
        const { expireTime } = await getFastForwardTimestamp(bs, marketId, trader);
        await fastForwardTo(expireTime + 10, provider());

        await assertRevert(
          PerpMarketProxy.connect(trader.signer).withdrawAllCollateral(trader.accountId, marketId),
          'OrderFound()',
          PerpMarketProxy
        );
      });

      it('should recompute funding', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, market } = await depositMargin(bs, genTrader(bs));

        // Execute withdrawAllCollateral.
        const { receipt } = await withExplicitEvmMine(
          () =>
            PerpMarketProxy.connect(trader.signer).withdrawAllCollateral(
              trader.accountId,
              market.marketId()
            ),
          provider()
        );
        await assertEvent(receipt, `FundingRecomputed()`, PerpMarketProxy);
      });

      it('should withdraw with fees and funding removed when no price changes', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId, market, collateral, collateralDepositAmount, traderAddress } =
          await depositMargin(
            bs,
            genTrader(bs, { desiredCollateral: genOneOf(collateralsWithoutSusd()) })
          ); // we exclude sUSD to get consistent debt behavior

        // Some generated collateral, trader combinations results with balance > `collateralDepositAmount`. So this
        // because the first collateral (sUSD) is partly configured by Synthetix Core. All traders receive _a lot_ of
        // that collateral so we need to track the full balance here.
        //
        // @see: https://github.com/Synthetixio/synthetix-v3/blob/main/protocol/synthetix/test/common/stakers.ts#L65
        const startingCollateralBalance = wei(
          await collateral.contract.balanceOf(traderAddress)
        ).add(collateralDepositAmount);

        // Open an order.
        const openOrder = await genOrder(bs, market, collateral, collateralDepositAmount);
        const { receipt: openReceipt } = await commitAndSettle(bs, marketId, trader, openOrder);

        // Immediately close the order.
        const closeOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredSize: wei(openOrder.sizeDelta).mul(-1).toBN(),
        });
        const { receipt: closeReceipt } = await commitAndSettle(bs, marketId, trader, closeOrder);

        // Get the fees from the open and close order events
        const openOrderEvent = findEventSafe(openReceipt, 'OrderSettled', PerpMarketProxy);
        const closeOrderEvent = findEventSafe(closeReceipt, 'OrderSettled', PerpMarketProxy);

        // payDebt will mint the sUSD so we don't expect that to affect final balance.
        await payDebt(bs, marketId, trader);

        const fees = wei(openOrderEvent?.args.orderFee)
          .add(openOrderEvent?.args.keeperFee)
          .add(closeOrderEvent?.args.orderFee)
          .add(closeOrderEvent?.args.keeperFee);

        // Pnl expected to be close to 0 since not oracle price change
        const pnl = calcPricePnl(openOrder.sizeDelta, closeOrder.fillPrice, openOrder.fillPrice);
        const expectedChangeUsd = wei(pnl)
          .sub(fees)
          .add(closeOrderEvent?.args.accruedFunding)
          .sub(closeOrderEvent?.args.accruedUtilization);

        // The account's debt should account for all the fees and pnl.
        assertBn.near(expectedChangeUsd.abs().toBN(), closeOrderEvent.args.accountDebt, bn(0.0001));

        // Perform the withdrawal.
        await PerpMarketProxy.connect(trader.signer).withdrawAllCollateral(
          trader.accountId,
          marketId
        );

        const actualBalance = await collateral.contract.balanceOf(traderAddress);

        // Since we minted sUSD to pay the debt we expect the balance to be the same as the starting balance.
        assertBn.near(startingCollateralBalance.toBN(), actualBalance, bn(0.0001));
      });

      forEach([
        ['sUSD', () => getSusdCollateral(collaterals())],
        ['non-sUSD', () => genOneOf(collateralsWithoutSusd())],
      ]).it(
        'should withdraw correct amounts after winning position (%s)',
        async (_, getCollateral: () => PerpCollateral) => {
          const { PerpMarketProxy, USD } = systems();
          const { trader, marketId, market, collateral, collateralDepositAmount, traderAddress } =
            await depositMargin(bs, genTrader(bs, { desiredCollateral: getCollateral() }));

          // Some generated collateral, trader combinations results with balance > `collateralDepositAmount`. So this
          // because the first collateral (sUSD) is partly configured by Synthetix Core. All traders receive _a lot_ of
          // that collateral so we need to track the full balance here.
          //
          // @see: https://github.com/Synthetixio/synthetix-v3/blob/main/protocol/synthetix/test/common/stakers.ts#L65
          const startingCollateralBalance = wei(
            await collateral.contract.balanceOf(traderAddress)
          ).add(collateralDepositAmount);

          // Open an order.
          const openOrder = await genOrder(bs, market, collateral, collateralDepositAmount);
          const { receipt: openReceipt } = await commitAndSettle(bs, marketId, trader, openOrder);
          const isLong = openOrder.sizeDelta.gt(0);

          // Increase or decrease market price 20%.
          const newMarketPrice = wei(openOrder.oraclePrice).mul(isLong ? 1.2 : 0.8);
          await market.aggregator().mockSetCurrentPrice(newMarketPrice.toBN());

          // Close the order.
          const closeOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
            desiredSize: wei(openOrder.sizeDelta).mul(-1).toBN(),
          });

          const { receipt: closeReceipt } = await commitAndSettle(bs, marketId, trader, closeOrder);

          // Get the fees from the open and close order events
          const openOrderEvent = findEventSafe(openReceipt, 'OrderSettled', PerpMarketProxy);
          const closeOrderEvent = findEventSafe(closeReceipt, 'OrderSettled', PerpMarketProxy);

          const pnl = calcPricePnl(openOrder.sizeDelta, closeOrder.fillPrice, openOrder.fillPrice);
          const orderFees = wei(openOrderEvent?.args.orderFee).add(closeOrderEvent?.args.orderFee);
          const keeperFees = wei(openOrderEvent?.args.keeperFee).add(
            closeOrderEvent?.args.keeperFee
          );
          const fees = orderFees.add(keeperFees);
          const expectedProfit = wei(pnl)
            .sub(fees)
            .add(closeOrderEvent?.args.accruedFunding)
            .sub(closeOrderEvent?.args.accruedUtilization);

          // Perform the withdrawal.
          await PerpMarketProxy.connect(trader.signer).withdrawAllCollateral(
            trader.accountId,
            marketId
          );

          // We expect to get back our full starting collateral balance.
          //
          // In the case where sUSD is our collateral then it should be startingBalance + winnings. When
          // the collateral is non-sUSD then we expect originalCollateralBalance + winnings(as sUSD).
          const closingCollateralBalance = await collateral.contract.balanceOf(traderAddress);
          if (isSusdCollateral(collateral)) {
            const expectedBalance = startingCollateralBalance.add(expectedProfit).toBN();
            assertBn.near(closingCollateralBalance, expectedBalance, bn(0.0001));
          } else {
            assertBn.near(closingCollateralBalance, startingCollateralBalance.toBN(), bn(0.0001));

            // Our pnl, minus fees, funding should be equal to our sUSD balance.
            const balance = await USD.balanceOf(traderAddress);

            assertBn.near(balance, expectedProfit.toBN(), bn(0.0001));
          }

          // Everything has been withdrawn. There should be no reportedDebt for this market.
          assertBn.near(await PerpMarketProxy.reportedDebt(marketId), bn(0), bn(0.000001));
        }
      );

      it('should withdraw correct amounts after losing position (sUSD)', async () => {
        const { PerpMarketProxy } = systems();

        const { trader, traderAddress, marketId, collateralDepositAmount, market, collateral } =
          await depositMargin(
            bs,
            genTrader(bs, { desiredCollateral: getSusdCollateral(collaterals()) })
          );

        const startingCollateralBalance = wei(
          await collateral.contract.balanceOf(traderAddress)
        ).add(collateralDepositAmount);

        // Open position.
        const openOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredSide: 1,
          desiredLeverage: 1,
        });
        const { receipt: openReceipt } = await commitAndSettle(bs, marketId, trader, openOrder);

        // Price change causing 50% loss.
        await market.aggregator().mockSetCurrentPrice(wei(openOrder.oraclePrice).mul(0.5).toBN());

        // Add some random wait time to lose some to funding as well
        const now = (await provider().getBlock('latest')).timestamp;
        await fastForwardTo(now + genNumber(1000, SECONDS_ONE_DAY), provider());
        // Close the order with a loss
        const closeOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredSize: wei(openOrder.sizeDelta).mul(-1).toBN(),
        });
        const { receipt: closeReceipt } = await commitAndSettle(bs, marketId, trader, closeOrder);

        // Collect some data for calculation.
        const { args: closeEventArgs } =
          findEventSafe(closeReceipt, 'OrderSettled', PerpMarketProxy) || {};
        const { args: openEventArgs } =
          findEventSafe(openReceipt, 'OrderSettled', PerpMarketProxy) || {};
        const pnl = calcPricePnl(openOrder.sizeDelta, closeOrder.fillPrice, openOrder.fillPrice);
        const openOrderFees = wei(openOrder.orderFee).add(openEventArgs?.keeperFee);
        const closeOrderFees = wei(closeOrder.orderFee).add(closeEventArgs?.keeperFee);
        const totalPnl = wei(pnl)
          .sub(openOrderFees)
          .sub(closeOrderFees)
          .add(closeEventArgs?.accruedFunding)
          .sub(closeEventArgs.accruedUtilization);

        await PerpMarketProxy.connect(trader.signer).withdrawAllCollateral(
          trader.accountId,
          marketId
        );

        const expectedCollateralBalanceAfterTrade = wei(startingCollateralBalance)
          .add(totalPnl)
          .toBN();
        const balanceAfterTrade = await collateral.contract.balanceOf(traderAddress);

        // Remaining balance after rekt.
        assertBn.near(expectedCollateralBalanceAfterTrade, balanceAfterTrade, bn(0.0001));
      });

      it('should withdraw correct amounts after losing position with margin changing (non-sUSD)', async () => {
        const { PerpMarketProxy, SpotMarket, Core } = systems();

        await setMarketConfiguration(bs, {
          maxCollateralDiscount: bn(0),
          minCollateralDiscount: bn(0),
        });

        const {
          trader,
          traderAddress,
          marketId,
          collateralDepositAmount,
          market,
          collateral,
          collateralPrice,
        } = await depositMargin(
          bs,
          genTrader(bs, { desiredCollateral: genOneOf(collateralsWithoutSusd()) })
        );

        // NOTE: Spot market skewScale _must_ be set to zero here as its too difficult to calculcate exact values from
        // an implicit skewFee applied on the collateral sale.
        await SpotMarket.connect(spotMarket.marketOwner()).setMarketSkewScale(
          collateral.synthMarketId(),
          bn(0)
        );

        const startingCollateralBalance = wei(
          await collateral.contract.balanceOf(traderAddress)
        ).add(collateralDepositAmount);

        const openOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredSide: 1,
          desiredLeverage: 1,
        });

        const { receipt: openReceipt } = await commitAndSettle(bs, marketId, trader, openOrder);

        // Collect some data for calculation.
        const { args: openEventArgs } =
          findEventSafe(openReceipt, 'OrderSettled', PerpMarketProxy) || {};

        // Only position on market causing loss in funding and paid to LPs.
        const currentBlockTimestamp = (await provider().getBlock('latest')).timestamp;
        await fastForwardTo(currentBlockTimestamp + genNumber(3000, 100_000), provider());

        // Price change causing 50% loss.
        await market.aggregator().mockSetCurrentPrice(wei(openOrder.oraclePrice).mul(0.5).toBN());

        // Collateral price increases by 10%.
        //
        // NOTE: This is the reason why this test cannot be sUSD. The margin collateral changes.
        const newCollateralPrice = wei(collateralPrice).mul(1.1);
        await collateral.setPrice(newCollateralPrice.toBN());

        // Close the order with a loss.
        const closeOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredSize: wei(openOrder.sizeDelta).mul(-1).toBN(),
        });
        const { receipt: closeReceipt } = await commitAndSettle(bs, marketId, trader, closeOrder);

        // Collect some data for calculation.
        const { args: closeEventArgs } =
          findEventSafe(closeReceipt, 'OrderSettled', PerpMarketProxy) || {};

        // Gather details to run local calculations for assertions.
        const pnl = calcPricePnl(
          openOrder.sizeDelta,
          closeEventArgs?.fillPrice,
          openEventArgs?.fillPrice
        );
        const openOrderFees = wei(openOrder.orderFee).add(openEventArgs?.keeperFee);
        const closeOrderFees = wei(closeOrder.orderFee).add(closeEventArgs?.keeperFee);
        const [keeperAddress, blockTimestamp] = await Promise.all([
          bs.keeper().getAddress(),
          provider()
            .getBlock(closeReceipt.blockHash)
            .then(({ timestamp }) => timestamp),
        ]);

        // Calculate diff amount.
        const usdDiffAmount = wei(pnl)
          .sub(openOrderFees)
          .sub(closeOrderFees)
          .add(closeEventArgs?.accruedFunding)
          .sub(closeEventArgs?.accruedUtilization);
        const collateralDiffAmount = usdDiffAmount.div(newCollateralPrice);
        const { debtUsd } = await PerpMarketProxy.getAccountDigest(trader.accountId, marketId);

        // Assert close position call. We want to make sure we've interacted with v3 Core correctly.
        //
        // `usdDiffAmount` will have some rounding errors so make sure our calculated is "near".
        assertBn.near(debtUsd, usdDiffAmount.abs().toBN(), bn(0.000001));

        const orderSettledEventArgs = [
          `${trader.accountId}`,
          `${marketId}`,
          `${blockTimestamp}`,
          `${closeOrder.sizeDelta}`,
          `${closeOrder.orderFee}`,
          `${closeEventArgs?.keeperFee}`,
          `${closeEventArgs?.accruedFunding}`,
          `${closeEventArgs?.accruedUtilization}`,
          `${closeEventArgs?.pnl}`,
          `${closeOrder.fillPrice}`,
          `${debtUsd}`,
        ].join(', ');

        // Assert events from all contracts, to make sure CORE's market manager is paid correctly
        await assertEvents(
          closeReceipt,
          [
            // Pyth price updates in Pyth contracts, don't care about exact values here.
            /PriceFeedUpdate/,
            // Funding recomputed, don't care about the exact values here.
            /FundingRecomputed/,
            /UtilizationRecomputed/,
            `Transfer("${ADDRESS0}", "${keeperAddress}", ${closeEventArgs?.keeperFee})`, // Part of withdrawing sUSD to pay keeper
            new RegExp(
              `MarketUsdWithdrawn\\(${marketId}, "${keeperAddress}", ${closeEventArgs?.keeperFee}, "${PerpMarketProxy.address}",`
            ), // Withdraw sUSD to pay keeper, note here that this amount is covered by the traders losses, so this amount will be included in MarketUsdDeposited (+ tail properties omitted)
            `OrderSettled(${orderSettledEventArgs})`,
            `MarketSizeUpdated(${marketId}, 0, 0)`,
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

        // Note: payDebt will mint the sUSD.
        await payDebt(bs, marketId, trader);

        // Actually do the withdraw.
        await PerpMarketProxy.connect(trader.signer).withdrawAllCollateral(
          trader.accountId,
          marketId
        );

        const balanceAfterTrade = await collateral.contract.balanceOf(traderAddress);

        // We expect to be losing.
        assertBn.lt(collateralDiffAmount.toBN(), bn(0));

        // Since the `payDebt` minted the usd, we expect the balance to be the same as the starting balance.
        assertBn.near(startingCollateralBalance.toBN(), balanceAfterTrade, bn(0.0001));

        // Everything has been withdrawn. There should be no reportedDebt for this market.
        assertBn.near(await PerpMarketProxy.reportedDebt(marketId), bn(0), bn(0.00001));
      });

      it(
        'should revert with InsufficientMarketCollateralWithdrawable from synthetix.MarketCollateralModule'
      );

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
          PerpMarketProxy.connect(trader.signer).withdrawAllCollateral(
            trader.accountId,
            invalidMarketId
          ),
          `MarketNotFound("${invalidMarketId}")`,
          PerpMarketProxy
        );
      });

      it('should revert when trader has a pending order', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId, collateral, market, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));

        await commitOrder(
          bs,
          marketId,
          trader,
          await genOrder(bs, market, collateral, collateralDepositAmount)
        );

        // Perform withdraw with invalid market
        await assertRevert(
          PerpMarketProxy.connect(trader.signer).withdrawAllCollateral(trader.accountId, marketId),
          `OrderFound()`,
          PerpMarketProxy
        );
      });

      it('should revert when trader has an open position', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId, collateral, market, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));
        await commitAndSettle(
          bs,
          marketId,
          trader,
          genOrder(bs, market, collateral, collateralDepositAmount)
        );

        // Perform withdraw with invalid market
        await assertRevert(
          PerpMarketProxy.connect(trader.signer).withdrawAllCollateral(trader.accountId, marketId),
          `PositionFound("${trader.accountId}", "${marketId}")`,
          PerpMarketProxy
        );
      });

      it('should revert when trader has debt', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId, collateral, market, collateralDepositAmount } =
          await depositMargin(
            bs,
            genTrader(bs, { desiredCollateral: genOneOf(collateralsWithoutSusd()) })
          );
        const order = await genOrder(bs, market, collateral, collateralDepositAmount);
        await commitAndSettle(bs, marketId, trader, order);
        const closeOrder = genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredSize: wei(order.sizeDelta).mul(-1).toBN(),
        });
        await commitAndSettle(bs, marketId, trader, closeOrder);

        await assertRevert(
          PerpMarketProxy.connect(trader.signer).withdrawAllCollateral(trader.accountId, marketId),
          `DebtFound("${trader.accountId}", "${marketId}")`,
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
            genTrader(bs, {
              desiredTrader: trader1,
              desiredCollateral: collateral,
              desiredMarket: market,
            })
          );
        }

        // Now attempt to withdraw everything using trader2.
        const permission = ethers.utils.formatBytes32String('PERPS_MODIFY_COLLATERAL');
        const signerAddress = await trader2.signer.getAddress();
        await assertRevert(
          PerpMarketProxy.connect(trader2.signer).withdrawAllCollateral(
            trader1.accountId,
            market.marketId()
          ),
          `PermissionDenied("${trader1.accountId}", "${permission}", "${signerAddress}")`,
          PerpMarketProxy
        );
      });

      it('should revert when flagged', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId, market, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));
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

  describe('setMarginMarginCollateralConfiguration', () => {
    it('should revert when config arrays has mismatched lengths', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();

      const synthMarketIds = [collaterals()[0].synthMarketId(), collaterals()[1].synthMarketId()];
      const maxAllowables = genListOf(genNumber(3, 10), () => bn(genNumber(10_000, 100_000)));
      const oracleNodeIds = genListOf(genNumber(3, 10), () => genBytes32());
      const rewardDistributors = genListOf(genNumber(3, 10), () => genAddress());

      await assertRevert(
        PerpMarketProxy.connect(from).setMarginCollateralConfiguration(
          synthMarketIds,
          oracleNodeIds,
          maxAllowables,
          rewardDistributors
        ),
        `ArrayLengthMismatch()`,
        PerpMarketProxy
      );
    });

    it('should configure and return many collaterals configured', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();

      const newCollaterals = shuffle(collaterals());
      const newSynthMarketIds = newCollaterals.map(({ synthMarketId }) => synthMarketId());
      const newOracleNodeIds = genListOf(newCollaterals.length, () => genBytes32());
      const newMaxAllowables = genListOf(newCollaterals.length, () =>
        bn(genNumber(10_000, 100_000))
      );
      const newRewardDistributors = newCollaterals.map(({ rewardDistributorAddress }) =>
        rewardDistributorAddress()
      );

      const { receipt } = await withExplicitEvmMine(
        () =>
          PerpMarketProxy.connect(from).setMarginCollateralConfiguration(
            newSynthMarketIds,
            newOracleNodeIds,
            newMaxAllowables,
            newRewardDistributors
          ),
        provider()
      );
      const configuredCollaterals = await PerpMarketProxy.getMarginCollateralConfiguration();

      assert.equal(configuredCollaterals.length, newCollaterals.length);

      for (const [_i, configuredCollateral] of Object.entries(configuredCollaterals)) {
        const idx = parseInt(_i);
        const { contract: synth, synthMarketId } = newCollaterals[idx];

        const perpAllowance = await synth.allowance(
          PerpMarketProxy.address,
          PerpMarketProxy.address
        );
        const coreAllowance = await synth.allowance(
          PerpMarketProxy.address,
          bs.systems().Core.address
        );
        if (synthMarketId().eq(SYNTHETIX_USD_MARKET_ID)) {
          assertBn.equal(ethers.constants.MaxUint256, perpAllowance);
        }
        assertBn.equal(ethers.constants.MaxUint256, coreAllowance);
        assertBn.equal(configuredCollateral.maxAllowable, newMaxAllowables[idx]);
      }

      await assertEvent(
        receipt,
        `MarginCollateralConfigured("${await from.getAddress()}", ${newCollaterals.length})`,
        PerpMarketProxy
      );
    });

    it('should remove an unsupported collateral when set with new collaterals', async () => {
      const { PerpMarketProxy, Core, SpotMarket } = systems();
      const from = owner();

      // Set a known set of supported collaterals.
      const supportedCollaterals = collaterals();
      const synthMarketIds1 = collaterals().map(({ synthMarketId }) => synthMarketId());
      const oracleNodeIds1 = collaterals().map(({ oracleNodeId }) => oracleNodeId());
      const maxAllowables1 = collaterals().map(() => bn(1));
      const rewardDistributors1 = collaterals().map(({ rewardDistributorAddress }) =>
        rewardDistributorAddress()
      );

      await PerpMarketProxy.connect(from).setMarginCollateralConfiguration(
        synthMarketIds1,
        oracleNodeIds1,
        maxAllowables1,
        rewardDistributors1
      );

      // Reconfigure the collaterals, removing one of them.
      const synthMarketIds2 = [
        supportedCollaterals[0].synthMarketId(),
        // supportedCollaterals[1].synthMarketId(), (removed!)
      ];
      const oracleNodeIds2 = [genBytes32()];
      const maxAllowables2 = [bn(1)];
      const rewardDistributors2 = [supportedCollaterals[0].rewardDistributorAddress()];

      await PerpMarketProxy.connect(from).setMarginCollateralConfiguration(
        synthMarketIds2,
        oracleNodeIds2,
        maxAllowables2,
        rewardDistributors2
      );

      const configuredCollaterals = await PerpMarketProxy.getMarginCollateralConfiguration();
      const removedCollateral = supportedCollaterals[1];

      const perpAllowance = await removedCollateral.contract.allowance(
        PerpMarketProxy.address,
        PerpMarketProxy.address
      );
      const coreAllowance = await removedCollateral.contract.allowance(
        PerpMarketProxy.address,
        Core.address
      );
      const spotAllowance = await removedCollateral.contract.allowance(
        PerpMarketProxy.address,
        SpotMarket.address
      );
      assertBn.isZero(perpAllowance);
      assertBn.isZero(coreAllowance);
      assertBn.isZero(spotAllowance);
      assert.equal(configuredCollaterals.length, 1);
      assert.equal(
        configuredCollaterals.filter((c) => c.synthMarketId.eq(removedCollateral.synthMarketId()))
          .length,
        0
      );
    });

    it('should allow zero maxAllowables to disable deposits', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();

      // Set zero allowable deposits.
      const supportedCollaterals = collaterals();
      const synthMarketIds = [
        supportedCollaterals[0].synthMarketId(),
        supportedCollaterals[1].synthMarketId(),
      ];
      const oracleNodeIds = [
        supportedCollaterals[0].oracleNodeId(),
        supportedCollaterals[1].oracleNodeId(),
      ];
      const maxAllowables = [bn(0), bn(0)];
      const rewardDistributors = [
        supportedCollaterals[0].rewardDistributorAddress(),
        supportedCollaterals[1].rewardDistributorAddress(),
      ];

      // Ensure we can set maxAllowables to 0 even when there's collateral in the system.
      await depositMargin(bs, genTrader(bs, { desiredCollateral: supportedCollaterals[0] }));

      await PerpMarketProxy.connect(from).setMarginCollateralConfiguration(
        synthMarketIds,
        oracleNodeIds,
        maxAllowables,
        rewardDistributors
      );

      const configuredCollaterals =
        await PerpMarketProxy.connect(from).getMarginCollateralConfiguration();
      assertBn.isZero(configuredCollaterals[0].maxAllowable);
      assertBn.isZero(configuredCollaterals[1].maxAllowable);
    });

    it('should revert when removal of collateral with amounts in the system', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();

      const supportedCollaterals = shuffle(collaterals());
      const { collateral } = await depositMargin(
        bs,
        genTrader(bs, { desiredCollateral: genOneOf(supportedCollaterals) })
      );

      // Excluding "collateral" with deposit and expect revert.
      const collateralsWithoutDeposit = supportedCollaterals.filter(
        ({ synthMarketId }) => synthMarketId() !== collateral.synthMarketId()
      );

      const synthMarketIds = collateralsWithoutDeposit.map(({ synthMarketId }) => synthMarketId());
      const oracleNodeIds = collateralsWithoutDeposit.map(({ oracleNodeId }) => oracleNodeId());
      const maxAllowables = collateralsWithoutDeposit.map(() => bn(0));
      const rewardDistributors = collateralsWithoutDeposit.map(({ rewardDistributorAddress }) =>
        rewardDistributorAddress()
      );

      await assertRevert(
        PerpMarketProxy.connect(from).setMarginCollateralConfiguration(
          synthMarketIds,
          oracleNodeIds,
          maxAllowables,
          rewardDistributors
        ),
        `MissingRequiredCollateral("${collateral.synthMarketId()}")`,
        PerpMarketProxy
      );
    });

    it('should allow removal of collateral with no amounts in the system', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();

      // Set zero allowable deposits.
      const supportedCollaterals = collaterals();

      // Excluding supportedCollaterals[0].synthMarketId(), which has a deposit.
      const synthMarketIds = [supportedCollaterals[1].synthMarketId()];
      const oracleNodeIds = [genBytes32()];
      const maxAllowables = [bn(0)];
      const rewardDistributors = [supportedCollaterals[1].rewardDistributorAddress()];

      await PerpMarketProxy.connect(from).setMarginCollateralConfiguration(
        synthMarketIds,
        oracleNodeIds,
        maxAllowables,
        rewardDistributors
      );
      const configuredCollaterals =
        await PerpMarketProxy.connect(from).getMarginCollateralConfiguration();
      assert.equal(configuredCollaterals.length, 1);
    });

    it('should reset existing collaterals when new config is empty', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();

      await PerpMarketProxy.connect(from).setMarginCollateralConfiguration([], [], [], []);
      const collaterals = await PerpMarketProxy.getMarginCollateralConfiguration();

      assert.equal(collaterals.length, 0);
    });

    it('should revert when non-owner', async () => {
      const { PerpMarketProxy } = systems();
      const from = await traders()[0].signer.getAddress();
      await assertRevert(
        PerpMarketProxy.connect(from).setMarginCollateralConfiguration([], [], [], []),
        `Unauthorized("${from}")`,
        PerpMarketProxy
      );
    });

    it('should revert when max allowable is negative', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();
      await assertRevert(
        PerpMarketProxy.connect(from).setMarginCollateralConfiguration(
          [bn(genNumber())],
          [],
          [bn(-1)],
          [collaterals()[0].rewardDistributorAddress()]
        ),
        'Error: value out-of-bounds',
        PerpMarketProxy
      );
    });

    it('should revert when an invalid synthMarketId is supplied as collateral', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();

      const synthMarketIds = [BigNumber.from(696969)];
      const oracleNodeIds = [genBytes32()];
      const maxAllowables = [BigNumber.from(1)];
      const rewardDistributors = [genOneOf(collaterals()).rewardDistributorAddress()];

      await assertRevert(
        PerpMarketProxy.connect(from).setMarginCollateralConfiguration(
          synthMarketIds,
          oracleNodeIds,
          maxAllowables,
          rewardDistributors
        ),
        `transaction reverted in contract unknown: 0x`,
        PerpMarketProxy
      );
    });

    it('should revert when a reward distributor address does not support interface', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();

      const collateral = genOneOf(collateralsWithoutSusd());
      const rewardDistributor = genAddress();

      const synthMarketIds = [collateral.synthMarketId()];
      const oracleNodeIds = [genBytes32()];
      const maxAllowables = [bn(0)];
      const rewardDistributors = [rewardDistributor];

      await assertRevert(
        PerpMarketProxy.connect(from).setMarginCollateralConfiguration(
          synthMarketIds,
          oracleNodeIds,
          maxAllowables,
          rewardDistributors
        ),
        `InvalidRewardDistributor("${rewardDistributor}")`,
        PerpMarketProxy
      );
    });

    it('should revert when a reward distributor for sUSD is not 0x0', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();

      const collateral = getSusdCollateral(collaterals());
      const rewardDistributor = genAddress();

      const synthMarketIds = [collateral.synthMarketId()];
      const oracleNodeIds = [genBytes32()];
      const maxAllowables = [bn(0)];
      const rewardDistributors = [rewardDistributor];

      await assertRevert(
        PerpMarketProxy.connect(from).setMarginCollateralConfiguration(
          synthMarketIds,
          oracleNodeIds,
          maxAllowables,
          rewardDistributors
        ),
        `InvalidRewardDistributor("${rewardDistributor}")`,
        PerpMarketProxy
      );
    });

    it('should revoke/approve collateral with 0/maxUint');
  });

  describe('setCollateralMaxAllowable', () => {
    it('should revert when max allowable is negative', async () => {
      const { PerpMarketProxy } = systems();

      const from = owner();
      const { synthMarketId } = genOneOf(collaterals());

      await assertRevert(
        PerpMarketProxy.connect(from).setCollateralMaxAllowable(synthMarketId(), bn(-1)),
        'Error: value out-of-bounds',
        PerpMarketProxy
      );
    });

    it('should revert when non-owner', async () => {
      const { PerpMarketProxy } = systems();

      const from = await traders()[0].signer.getAddress();
      await assertRevert(
        PerpMarketProxy.connect(from).setCollateralMaxAllowable(bn(0), bn(0)),
        `Unauthorized("${from}")`,
        PerpMarketProxy
      );
    });

    it('should revert when invalid collateralId', async () => {
      const { PerpMarketProxy } = systems();

      const from = owner();
      const invalidCollateralId = bn(42069);

      await assertRevert(
        PerpMarketProxy.connect(from).setCollateralMaxAllowable(invalidCollateralId, bn(0)),
        `UnsupportedCollateral("${invalidCollateralId}")`,
        PerpMarketProxy
      );
    });

    forEach([bn(0), bn(genNumber(20_000, 30_000)), bn(genNumber(30_001, 50_000))]).it(
      `should update max allowable for '%s'`,
      async (newMaxAllowable) => {
        const { PerpMarketProxy } = systems();
        const from = owner();

        const collateral = genOneOf(collaterals());

        const { maxAllowable: maxAllowableBefore } = findOrThrow(
          await PerpMarketProxy.getMarginCollateralConfiguration(),
          ({ synthMarketId }) => synthMarketId.eq(collateral.synthMarketId())
        );

        assertBn.gt(maxAllowableBefore, bn(0));

        await PerpMarketProxy.connect(from).setCollateralMaxAllowable(
          collateral.synthMarketId(),
          newMaxAllowable
        );
        const configuredCollateral = await PerpMarketProxy.getMarginCollateralConfiguration();

        const { maxAllowable: maxAllowableAfter } = findOrThrow(
          configuredCollateral,
          ({ synthMarketId }) => synthMarketId.eq(collateral.synthMarketId())
        );
        assertBn.equal(maxAllowableAfter, newMaxAllowable);
      }
    );
  });

  describe('getMarginDigest', () => {
    it('should revert when accountId does not exist', async () => {
      const { PerpMarketProxy } = systems();
      const { marketId } = await genTrader(bs);
      const invalidAccountId = 42069;

      await assertRevert(
        PerpMarketProxy.getMarginDigest(invalidAccountId, marketId),
        `AccountNotFound("${invalidAccountId}")`,
        PerpMarketProxy
      );
    });

    it('should revert when marketId does not exist', async () => {
      const { PerpMarketProxy } = systems();
      const { trader } = await genTrader(bs);
      const invalidMarketId = 42069;

      await assertRevert(
        PerpMarketProxy.getMarginDigest(trader.accountId, invalidMarketId),
        `MarketNotFound("${invalidMarketId}")`,
        PerpMarketProxy
      );
    });

    describe('collateralUsd', () => {
      it('should return the usd amount in collateral', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId, marginUsdDepositAmount } = await depositMargin(bs, genTrader(bs));

        await setMarketConfiguration(bs, {
          minCollateralDiscount: bn(0),
          maxCollateralDiscount: bn(0),
        });
        const { collateralUsd } = await PerpMarketProxy.getMarginDigest(trader.accountId, marketId);
        assertBn.near(collateralUsd, marginUsdDepositAmount);
      });

      it('should return usd amount after price of collateral changes (non-usd)', async () => {
        const { PerpMarketProxy } = systems();

        // We can't use sUSD here because it should always be 1 within the system.
        const collateral = genOneOf(collateralsWithoutSusd());

        const {
          trader,
          marketId,
          marginUsdDepositAmount,
          collateralPrice,
          collateralDepositAmount,
        } = await depositMargin(bs, genTrader(bs, { desiredCollateral: collateral }));

        await setMarketConfiguration(bs, {
          minCollateralDiscount: bn(0),
          maxCollateralDiscount: bn(0),
        });
        const { collateralUsd: collateralUsdBefore } = await PerpMarketProxy.getMarginDigest(
          trader.accountId,
          marketId
        );

        assertBn.near(collateralUsdBefore, marginUsdDepositAmount);

        // Change price.
        const newCollateralPrice = wei(collateralPrice).mul(2).toBN();
        await collateral.setPrice(newCollateralPrice);
        const { collateralUsd } = await PerpMarketProxy.getMarginDigest(trader.accountId, marketId);
        const expected = wei(collateralDepositAmount).mul(newCollateralPrice).toBN();

        assertBn.equal(collateralUsd, expected);
      });

      it('should return zero when collateral has not been deposited', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId } = await genTrader(bs);
        const { collateralUsd } = await PerpMarketProxy.getMarginDigest(trader.accountId, marketId);

        assertBn.isZero(collateralUsd);
      });
    });

    describe('marginUsd', () => {
      it('should return marginUsd that reflects value of collateral when no positions opened', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId, collateralDepositAmount, collateralPrice } = await depositMargin(
          bs,
          genTrader(bs)
        );

        await setMarketConfiguration(bs, {
          maxCollateralDiscount: bn(0),
          minCollateralDiscount: bn(0),
        });

        const { marginUsd } = await PerpMarketProxy.getMarginDigest(trader.accountId, marketId);

        assertBn.equal(marginUsd, wei(collateralDepositAmount).mul(collateralPrice).toBN());
      });

      it('should return zero marginUsd when no collateral has been deposited', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId } = await genTrader(bs);
        const { marginUsd } = await PerpMarketProxy.getMarginDigest(trader.accountId, marketId);

        assertBn.isZero(marginUsd);
      });

      it('should return marginUsd + pnl of position', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId, collateral, market, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));
        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredLeverage: 1.1,
        });

        await setMarketConfiguration(bs, {
          maxCollateralDiscount: bn(0),
          minCollateralDiscount: bn(0),
        });

        const { receipt } = await commitAndSettle(bs, marketId, trader, order);
        const settleEvent = findEventSafe(receipt, 'OrderSettled', PerpMarketProxy);
        const keeperFee = settleEvent?.args.keeperFee as BigNumber;
        const { marginUsd: marginUsdBeforePriceChange } = await PerpMarketProxy.getMarginDigest(
          trader.accountId,
          marketId
        );

        const pnl = calcPricePnl(order.sizeDelta, order.oraclePrice, order.fillPrice);
        const expectedMarginUsdBeforePriceChange = wei(order.marginUsd)
          .sub(order.orderFee)
          .sub(keeperFee)
          .add(order.keeperFeeBufferUsd)
          .add(pnl);

        // Assert margin before price change
        assertBn.near(
          marginUsdBeforePriceChange,
          expectedMarginUsdBeforePriceChange.toBN(),
          bn(0.000001)
        );

        // Change the price, this might lead to profit or loss, depending the the generated order is long or short
        const newPrice = wei(order.oraclePrice).mul(1.5).toBN();
        // Update price
        await market.aggregator().mockSetCurrentPrice(newPrice);

        // Collect some data for expected margin calculation
        const { accruedFunding, accruedUtilization } = await PerpMarketProxy.getPositionDigest(
          trader.accountId,
          marketId
        );
        const newPnl = calcPricePnl(order.sizeDelta, newPrice, order.fillPrice);

        const { marginUsd: marginUsdAfterPriceChange } = await PerpMarketProxy.getMarginDigest(
          trader.accountId,
          marketId
        );

        // Calculate expected margin
        const expectedMarginUsdAfterPriceChange = wei(order.marginUsd)
          .sub(order.orderFee)
          .sub(keeperFee)
          .add(order.keeperFeeBufferUsd)
          .add(newPnl)
          .add(accruedFunding)
          .sub(accruedUtilization);

        // Assert marginUSD after price update.
        assertBn.near(
          marginUsdAfterPriceChange,
          expectedMarginUsdAfterPriceChange.toBN(),
          bn(0.000001)
        );
      });

      it('should return 0 for underwater position not yet flagged', async () => {
        const { PerpMarketProxy } = systems();
        const { trader, marketId, collateral, market, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));
        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredLeverage: 2,
          desiredSide: -1,
        });

        await setMarketConfiguration(bs, {
          maxCollateralDiscount: bn(0),
          minCollateralDiscount: bn(0),
        });

        await commitAndSettle(bs, marketId, trader, order);

        const { marginUsd: marginUsdBeforePriceChange } = await PerpMarketProxy.getMarginDigest(
          trader.accountId,
          marketId
        );
        assertBn.gt(marginUsdBeforePriceChange, 0);

        // Price double, causing our short to be underwater
        const newPrice = wei(order.oraclePrice).mul(2).toBN();

        // Update price
        await market.aggregator().mockSetCurrentPrice(newPrice);

        // Load margin again
        const { marginUsd: marginUsdAfterPriceChange } = await PerpMarketProxy.getMarginDigest(
          trader.accountId,
          marketId
        );
        // Assert marginUSD is 0 since price change made the position underwater
        assertBn.isZero(marginUsdAfterPriceChange);
      });

      it('should not consider a position in a different market for the same account', async () => {
        const { PerpMarketProxy } = systems();

        const { marketId, trader, collateralDepositAmount, collateralPrice } = await depositMargin(
          bs,
          genTrader(bs, { desiredMarket: bs.markets()[0] })
        );

        await setMarketConfiguration(bs, {
          maxCollateralDiscount: bn(0),
          minCollateralDiscount: bn(0),
        });

        // Deposit margin to another market
        const otherDeposit = await depositMargin(
          bs,
          genTrader(bs, { desiredMarket: bs.markets()[1], desiredTrader: trader })
        );

        const { marginUsd: marginBeforeTradeOnDiffMarket } = await PerpMarketProxy.getMarginDigest(
          trader.accountId,
          marketId
        );
        assertBn.equal(
          marginBeforeTradeOnDiffMarket,
          wei(collateralDepositAmount).mul(collateralPrice).toBN()
        );

        // Generate and execute an order for the other market
        const order = await genOrder(
          bs,
          otherDeposit.market,
          otherDeposit.collateral,
          otherDeposit.collateralDepositAmount
        );
        await commitAndSettle(bs, otherDeposit.marketId, otherDeposit.trader, order);

        // Assert that collateral is still the same.
        const { marginUsd: marginAfterTradeOnDiffMarket } = await PerpMarketProxy.getMarginDigest(
          trader.accountId,
          marketId
        );

        // Margin should stay unchanged.
        assertBn.equal(marginBeforeTradeOnDiffMarket, marginAfterTradeOnDiffMarket);
      });

      it('should reflect collateral price changes (non-usd)', async () => {
        const { PerpMarketProxy } = systems();

        const collateral = genOneOf(collateralsWithoutSusd());
        const { trader, marketId, collateralDepositAmount, collateralPrice } = await depositMargin(
          bs,
          genTrader(bs, { desiredCollateral: collateral })
        );

        await setMarketConfiguration(bs, {
          maxCollateralDiscount: bn(0),
          minCollateralDiscount: bn(0),
        });

        const { marginUsd: marginUsdBeforePriceChange } = await PerpMarketProxy.getMarginDigest(
          trader.accountId,
          marketId
        );
        assertBn.equal(
          marginUsdBeforePriceChange,
          wei(collateralDepositAmount).mul(collateralPrice).toBN()
        );

        const newPrice = wei(collateralPrice)
          .mul(genOneOf([1.1, 0.9]))
          .toBN();
        await collateral.setPrice(newPrice);

        const { marginUsd: marginUsdAfterPriceChange } = await PerpMarketProxy.getMarginDigest(
          trader.accountId,
          marketId
        );
        assertBn.equal(
          marginUsdAfterPriceChange,
          wei(collateralDepositAmount).mul(newPrice).toBN()
        );
      });
    });
  });

  describe('getNetAssetValue', () => {
    it('should eq marginUsd from getMarginDigest', async () => {
      const { PerpMarketProxy } = systems();
      const { trader, marketId, collateral, market, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 1.1,
      });

      await commitAndSettle(bs, marketId, trader, order);

      const { marginUsd } = await PerpMarketProxy.getMarginDigest(trader.accountId, marketId);
      const netAssetValue = await PerpMarketProxy.getNetAssetValue(
        trader.accountId,
        marketId,
        order.oraclePrice
      );

      assertBn.equal(netAssetValue, marginUsd);
    });

    it('should use default oracle price if no price was specified', async () => {
      const { PerpMarketProxy } = systems();
      const { trader, marketId, collateral, market, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 1.1,
      });

      await commitAndSettle(bs, marketId, trader, order);

      const { marginUsd } = await PerpMarketProxy.getMarginDigest(trader.accountId, marketId);
      const netAssetValue = await PerpMarketProxy.getNetAssetValue(trader.accountId, marketId, 0);

      assertBn.equal(netAssetValue, marginUsd);
    });
  });

  describe('getWithdrawableMargin', () => {
    it('should revert when accountId does not exist', async () => {
      const { PerpMarketProxy } = systems();

      const { marketId } = await depositMargin(bs, genTrader(bs));
      const invalidAccountId = 42069;

      await assertRevert(
        PerpMarketProxy.getWithdrawableMargin(invalidAccountId, marketId),
        `AccountNotFound("${invalidAccountId}")`,
        PerpMarketProxy
      );
    });

    it('should revert when marketId does not exist', async () => {
      const { PerpMarketProxy } = systems();

      const { trader } = await depositMargin(bs, genTrader(bs));
      const invalidMarketId = 42069;

      await assertRevert(
        PerpMarketProxy.getWithdrawableMargin(trader.accountId, invalidMarketId),
        `MarketNotFound("${invalidMarketId}")`,
        PerpMarketProxy
      );
    });

    it('should return zero when no collateral deposits', async () => {
      const { PerpMarketProxy } = systems();

      const { trader } = await genTrader(bs);
      const { marketId } = genOneOf(markets());

      const margin = await PerpMarketProxy.getWithdrawableMargin(trader.accountId, marketId());
      assertBn.isZero(margin);
    });

    it('should return the full collateralUsd value when no position open', async () => {
      const { PerpMarketProxy } = systems();

      const desiredMarginUsdDepositAmount = genOneOf([5000, 10_000, 20_000]);
      const { trader, marketId } = await depositMargin(
        bs,
        genTrader(bs, { desiredMarginUsdDepositAmount })
      );

      const margin = await PerpMarketProxy.getWithdrawableMargin(trader.accountId, marketId);
      assertBn.near(margin, bn(desiredMarginUsdDepositAmount), bn(0.000001));
    });

    it('should return the full collateralUsd value minus debt when no position open (concrete)', async () => {
      const { PerpMarketProxy } = systems();

      const desiredMarginUsdDepositAmount = genNumber(10_000, 15_000);
      const { trader, marketId, collateral, market, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, {
          desiredMarginUsdDepositAmount,
          // NOTE: We cannot use sUSD collateral because debt will not increase if there's enough sUSD credit.
          desiredCollateral: genOneOf(collateralsWithoutSusd()),
        })
      );

      const openOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 1.1,
        desiredSide: -1,
      });

      await commitAndSettle(bs, marketId, trader, openOrder);

      // Pump the price to cause some debt.
      await market.aggregator().mockSetCurrentPrice(wei(openOrder.oraclePrice).mul(1.2).toBN());

      // Realize the loss into debt.
      const closeOrder = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredSize: openOrder.sizeDelta.mul(-1),
      });
      await commitAndSettle(bs, marketId, trader, closeOrder);

      const { collateralUsd, debtUsd } = await PerpMarketProxy.getAccountDigest(
        trader.accountId,
        marketId
      );

      // There is _some_ debt on the account.
      assertBn.gt(debtUsd, bn(0));

      const margin = await PerpMarketProxy.getWithdrawableMargin(trader.accountId, marketId);
      const expectedMargin = collateralUsd.sub(debtUsd);

      assertBn.equal(margin, expectedMargin);
    });

    it('should return the discounted marginUsd less IM/keeperFees when position open');
  });

  describe('getMarginCollateralConfiguration', () => {
    it('should return empty when there are no configured collaterals', async () => {
      const { PerpMarketProxy } = systems();

      const from = owner();
      await PerpMarketProxy.connect(from).setMarginCollateralConfiguration([], [], [], []);

      const collaterals = await PerpMarketProxy.getMarginCollateralConfiguration();
      assert.equal(collaterals.length, 0);
    });
  });

  describe('getDiscountedCollateralPrice', () => {
    forEach([bn(0), bn(genNumber(1, 10_000))]).it(
      'should return 1 when sUSD is the oracle price regardless of amount (%s)',
      async (amount: BigNumber) => {
        const { PerpMarketProxy } = systems();

        const sUsdCollateral = getSusdCollateral(collaterals());
        const collateralPrice = await PerpMarketProxy.getDiscountedCollateralPrice(
          sUsdCollateral.synthMarketId(),
          amount
        );
        assertBn.equal(collateralPrice, bn(1));
      }
    );

    it('should not apply a discount on collateral price when spot market skew is 0', async () => {
      const { PerpMarketProxy, SpotMarket } = systems();

      const collateral = genOneOf(collateralsWithoutSusd());
      await SpotMarket.connect(spotMarket.marketOwner()).setMarketSkewScale(
        collateral.synthMarketId(),
        bn(0)
      );

      const collateralPrice = await collateral.getPrice();
      const priceWithDiscount = await PerpMarketProxy.getDiscountedCollateralPrice(
        collateral.synthMarketId(),
        bn(0)
      );

      assertBn.equal(collateralPrice, priceWithDiscount);
    });

    it('should return oracle price when amount and minCollateralDiscount is 0', async () => {
      const { PerpMarketProxy } = systems();

      await setMarketConfiguration(bs, { minCollateralDiscount: bn(0) });

      const collateral = genOneOf(collateralsWithoutSusd());

      const collateralPrice = await collateral.getPrice();
      const priceWithDiscount = await PerpMarketProxy.getDiscountedCollateralPrice(
        collateral.synthMarketId(),
        bn(0)
      );

      assertBn.equal(collateralPrice, priceWithDiscount);
    });

    it('should max bound the collateral discount on large skew shift', async () => {
      const { PerpMarketProxy, SpotMarket } = systems();

      const collateral = genOneOf(collateralsWithoutSusd());
      const collateralPrice = await collateral.getPrice();

      const maxCollateralDiscount = bn(0.02);
      await setMarketConfiguration(bs, {
        minCollateralDiscount: bn(0.01),
        maxCollateralDiscount,
        collateralDiscountScalar: bn(0.5),
      });
      await SpotMarket.connect(spotMarket.marketOwner()).setMarketSkewScale(
        collateral.synthMarketId(),
        bn(500_000)
      );

      // price = oraclePrice * (1 - min(max((amount * collateralDiscountScalar) / skewScale), minCollateralDiscount), maxCollateralDiscount))
      //
      // (30k * 0.5) / 500k * 2 = 0.03 (bounded by max is 0.02).
      const amount = bn(30_000);

      const expectedPrice = wei(collateralPrice).mul(bn(1).sub(maxCollateralDiscount)).toBN();
      const priceWithDiscount = await PerpMarketProxy.getDiscountedCollateralPrice(
        collateral.synthMarketId(),
        amount
      );

      assertBn.equal(priceWithDiscount, expectedPrice);
    });

    it('should min bound the collateral discount on small skew shift', async () => {
      const { PerpMarketProxy, SpotMarket } = systems();

      const collateral = genOneOf(collateralsWithoutSusd());
      const collateralPrice = await collateral.getPrice();

      const minCollateralDiscount = bn(0.01);
      await setMarketConfiguration(bs, {
        minCollateralDiscount,
        maxCollateralDiscount: bn(0.2),
        collateralDiscountScalar: bn(0.5),
      });
      await SpotMarket.connect(spotMarket.marketOwner()).setMarketSkewScale(
        collateral.synthMarketId(),
        bn(500_000)
      );

      // price = oraclePrice * (1 - min(max((amount * collateralDiscountScalar) / skewScale), minCollateralDiscount), maxCollateralDiscount))
      //
      // (500 * 0.5) / 500k * 2 = 0.0005 (bounded by min is 0.01).
      const amount = bn(500);

      const expectedPrice = wei(collateralPrice).mul(bn(1).sub(minCollateralDiscount)).toBN();
      const priceWithDiscount = await PerpMarketProxy.getDiscountedCollateralPrice(
        collateral.synthMarketId(),
        amount
      );

      assertBn.equal(priceWithDiscount, expectedPrice);
    });

    it('should match the expected discounted collateral price', async () => {
      const { PerpMarketProxy, SpotMarket } = systems();

      const collateral = genOneOf(collaterals());
      const collateralPrice = await collateral.getPrice();

      const minCollateralDiscount = bn(0.0001);
      const maxCollateralDiscount = bn(0.99);
      const collateralDiscountScalar = bn(0.5);
      await setMarketConfiguration(bs, {
        minCollateralDiscount,
        maxCollateralDiscount,
        collateralDiscountScalar,
      });

      const spotMarketSkewScale = bn(500_000);

      await withExplicitEvmMine(
        () =>
          SpotMarket.connect(spotMarket.marketOwner()).setMarketSkewScale(
            collateral.synthMarketId(),
            spotMarketSkewScale
          ),
        provider()
      );

      const amount = bn(genNumber(3000, 5000));

      const expectedPrice = calcDiscountedCollateralPrice(
        collateralPrice,
        amount,
        spotMarketSkewScale,
        collateralDiscountScalar,
        minCollateralDiscount,
        maxCollateralDiscount
      );
      const actualPrice = await PerpMarketProxy.getDiscountedCollateralPrice(
        collateral.synthMarketId(),
        amount
      );

      assertBn.equal(actualPrice, expectedPrice);
    });
  });
});
