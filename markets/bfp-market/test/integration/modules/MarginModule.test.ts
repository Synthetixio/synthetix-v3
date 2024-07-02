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
  genOrderFromSizeDelta,
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
    traders,
    owner,
    systems,
    provider,
    restore,
  } = bs;

  beforeEach(restore);

  describe('modifyCollateral', () => {
    it('should revert when modifying if expired order exists', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, market, marketId, collateral, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

      // Commit an order for this trader.
      await commitOrder(bs, marketId, trader, order);

      // Verify that an order exists.
      const pendingOrder = await BfpMarketProxy.getOrderDigest(trader.accountId, marketId);
      assertBn.equal(pendingOrder.sizeDelta, order.sizeDelta);

      // Fastforward to expire the pending order.
      const { maxOrderAge } = await BfpMarketProxy.getMarketConfiguration();
      await fastForwardBySec(provider(), maxOrderAge.toNumber() + 1);

      await assertRevert(
        BfpMarketProxy.connect(trader.signer).modifyCollateral(
          trader.accountId,
          marketId,
          collateral.address(),
          collateralDepositAmount.mul(-1)
        ),
        `OrderFound()`,
        BfpMarketProxy
      );
    });

    it('should revert when a transfer amount of 0', async () => {
      const { BfpMarketProxy } = systems();

      const trader = genOneOf(traders());
      const market = genOneOf(markets());
      const collateral = genOneOf(collaterals());
      const amountDelta = bn(0);

      await assertRevert(
        BfpMarketProxy.connect(trader.signer).modifyCollateral(
          trader.accountId,
          market.marketId(),
          collateral.address(),
          amountDelta
        ),
        `ZeroAmount()`,
        BfpMarketProxy
      );
    });

    it('should recompute funding', async () => {
      const { BfpMarketProxy } = systems();
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
          BfpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            market.marketId(),
            collateral.address(),
            collateralDepositAmount2
          ),
        provider()
      );
      await assertEvent(receipt, `FundingRecomputed`, BfpMarketProxy);
    });

    it('should revert on modify when an order is pending', async () => {
      const { BfpMarketProxy } = systems();

      const { market, collateral, collateralDepositAmount, marketId, trader } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount);

      // Commit an order for this trader.
      await commitOrder(bs, marketId, trader, order);

      // Verify that an order exists.
      const pendingOrder = await BfpMarketProxy.getOrderDigest(trader.accountId, marketId);
      assertBn.equal(pendingOrder.sizeDelta, order.sizeDelta);

      // (deposit) Same trader in the same market but (possibly) different collateral.
      const gTrader2 = await genTrader(bs, { desiredTrader: trader, desiredMarket: market });

      // (deposit) Mint and give access.
      await mintAndApproveWithTrader(bs, gTrader2);

      // (deposit) Perform deposit but expect failure.
      await assertRevert(
        BfpMarketProxy.connect(trader.signer).modifyCollateral(
          trader.accountId,
          marketId,
          gTrader2.collateral.address(),
          gTrader2.collateralDepositAmount
        ),
        `OrderFound()`,
        BfpMarketProxy
      );

      // (withdraw) Attempt to withdraw previously deposited margin but expect fail.
      await assertRevert(
        BfpMarketProxy.connect(trader.signer).modifyCollateral(
          trader.accountId,
          marketId,
          collateral.address(),
          collateralDepositAmount.mul(-1)
        ),
        `OrderFound()`,
        BfpMarketProxy
      );
    });

    it('should revert when modifying collateral of another account', async () => {
      const { BfpMarketProxy } = systems();
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
        BfpMarketProxy.connect(trader2.signer).modifyCollateral(
          trader1.accountId,
          market.marketId(),
          collateral.address(),
          collateralDepositAmount
        ),
        `PermissionDenied("${trader1.accountId}", "${permission}", "${signerAddress}")`,
        BfpMarketProxy
      );
    });

    describe('deposit', () => {
      it('should allow deposit of collateral', async () => {
        const { BfpMarketProxy } = systems();

        const trader = genOneOf(traders());
        const traderAddress = await trader.signer.getAddress();

        const market = genOneOf(markets());
        const collateral = genOneOf(collaterals());
        const amountDelta = bn(genNumber(50, 100_000));

        await mintAndApprove(bs, collateral, amountDelta, trader.signer);

        const balanceBefore = await collateral.contract.balanceOf(traderAddress);

        const { receipt } = await withExplicitEvmMine(
          () =>
            BfpMarketProxy.connect(trader.signer).modifyCollateral(
              trader.accountId,
              market.marketId(),
              collateral.address(),
              amountDelta
            ),
          provider()
        );

        const marginDepositEventProperties = [
          `"${traderAddress}"`,
          `"${BfpMarketProxy.address}"`,
          amountDelta,
          `"${collateral.address()}"`,
        ].join(', ');
        await assertEvent(
          receipt,
          `MarginDeposit(${marginDepositEventProperties})`,
          BfpMarketProxy
        );

        const expectedBalanceAfter = balanceBefore.sub(amountDelta);
        assertBn.equal(await collateral.contract.balanceOf(traderAddress), expectedBalanceAfter);
      });

      it('should allow deposit of collateral when collateral maxMarketSize is 0', async () => {
        const { BfpMarketProxy } = systems();

        const { collateral, collateralDepositAmount, trader, market } = await depositMargin(
          bs,
          genTrader(bs)
        );

        await setMarketConfigurationById(bs, market.marketId(), { maxMarketSize: bn(0) });
        const { maxMarketSize } = await BfpMarketProxy.getMarketConfigurationById(
          market.marketId()
        );
        assertBn.equal(maxMarketSize, bn(0));

        await mintAndApprove(bs, collateral, collateralDepositAmount, trader.signer);

        // Should also be able to deposit.
        const { receipt: depositReceipt } = await withExplicitEvmMine(
          () =>
            BfpMarketProxy.connect(trader.signer).modifyCollateral(
              trader.accountId,
              market.marketId(),
              collateral.address(),
              collateralDepositAmount
            ),
          provider()
        );

        await assertEvent(depositReceipt, 'MarginDeposit', BfpMarketProxy);
      });

      forEach([
        ['sUSD', () => getSusdCollateral(collaterals())],
        ['non-sUSD', () => genOneOf(collateralsWithoutSusd())],
      ]).it(
        'should emit all events in correct order (%s)',
        async (_, getCollateral: () => PerpCollateral) => {
          const { BfpMarketProxy, Core } = systems();

          const { collateral, trader, traderAddress, collateralDepositAmount, marketId } =
            await mintAndApproveWithTrader(
              bs,
              await genTrader(bs, { desiredCollateral: getCollateral() })
            );

          // Perform the deposit.
          const { receipt } = await withExplicitEvmMine(
            () =>
              BfpMarketProxy.connect(trader.signer).modifyCollateral(
                trader.accountId,
                marketId,
                collateral.address(),
                collateralDepositAmount
              ),
            provider()
          );
          const coreAbi = Core.interface.format(utils.FormatTypes.full) as string[];
          // Create a contract that can parse all events emitted.
          const contractsWithAllEvents = extendContractAbi(
            BfpMarketProxy,
            coreAbi.concat([
              'event Transfer(address indexed from, address indexed to, uint256 value)',
            ])
          );

          const marginDepositEventProperties = [
            `"${traderAddress}"`,
            `"${BfpMarketProxy.address}"`,
            collateralDepositAmount,
            `"${collateral.address()}"`,
          ].join(', ');

          if (isSusdCollateral(collateral)) {
            await assertEvents(
              receipt,
              [
                /FundingRecomputed/,
                /UtilizationRecomputed/,
                `Transfer("${traderAddress}", "${ADDRESS0}", ${collateralDepositAmount})`,
                new RegExp(
                  `MarketUsdDeposited\\(${marketId}, "${traderAddress}", ${collateralDepositAmount}, "${BfpMarketProxy.address}",`
                ), // + tail properties omitted
                `MarginDeposit(${marginDepositEventProperties})`,
              ],
              contractsWithAllEvents
            );
          } else {
            const marketCollateralDepositedEventProperties = [
              marketId,
              `"${collateral.address()}"`,
              collateralDepositAmount,
              `"${BfpMarketProxy.address}"`,
            ].join(', ');
            await assertEvents(
              receipt,
              [
                /FundingRecomputed/,
                /UtilizationRecomputed/,
                `Transfer("${traderAddress}", "${BfpMarketProxy.address}", ${collateralDepositAmount})`, // From collateral ERC20 contract
                `Transfer("${BfpMarketProxy.address}", "${Core.address}", ${collateralDepositAmount})`, // From collateral ERC20 contract
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
        const { BfpMarketProxy } = systems();

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
        const positionDigest = await BfpMarketProxy.getPositionDigest(accountId, marketId);
        assertBn.equal(positionDigest.size, order.sizeDelta);

        // Get predeposit collateralUsd.
        const { collateralUsd: collateralUsd1 } = await BfpMarketProxy.getMarginDigest(
          accountId,
          marketId
        );

        // Deposit more margin, verify, and get post deposit collateralUsd.
        const deposit2 = await depositMargin(bs, gTrader);
        const { collateralUsd: collateralUsd2 } = await BfpMarketProxy.getMarginDigest(
          accountId,
          marketId
        );

        assertBn.near(collateralUsd2, collateralUsd1.add(deposit2.marginUsdDepositAmount));
      });

      it('should revert deposit to an account that does not exist', async () => {
        const { BfpMarketProxy } = systems();

        const trader = genOneOf(traders());
        const invalidAccountId = genNumber(42069, 50000);

        const market = genOneOf(markets());
        const collateral = genOneOf(collaterals());
        const amountDelta = bn(genNumber(50, 100_000));

        await mintAndApprove(bs, collateral, amountDelta, trader.signer);

        await assertRevert(
          BfpMarketProxy.connect(trader.signer).modifyCollateral(
            invalidAccountId,
            market.marketId(),
            collateral.address(),
            amountDelta
          ),
          `PermissionDenied("${invalidAccountId}"`,
          BfpMarketProxy
        );
      });

      it('should revert depositing to a market that does not exist', async () => {
        const { BfpMarketProxy } = systems();

        const gTrader = genTrader(bs);
        const { trader, collateral, collateralDepositAmount } = await mintAndApproveWithTrader(
          bs,
          gTrader
        );
        const invalidMarketId = bn(genNumber(42069, 50_000));

        // Perform deposit with invalid market id.
        await assertRevert(
          BfpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            invalidMarketId,
            collateral.address(),
            collateralDepositAmount
          ),
          `MarketNotFound("${invalidMarketId}")`,
          BfpMarketProxy
        );
      });

      it('should revert deposit of unsupported collateral', async () => {
        const { BfpMarketProxy } = systems();

        const trader = genOneOf(traders());
        const market = genOneOf(markets());
        const invalidCollateral = genAddress();
        const amountDelta = bn(genNumber(10, 100));

        await assertRevert(
          BfpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            market.marketId(),
            invalidCollateral,
            amountDelta
          ),
          `UnsupportedCollateral("${invalidCollateral}")`,
          BfpMarketProxy
        );
      });

      it('should revert deposit that exceeds max cap', async () => {
        const { BfpMarketProxy } = systems();

        const trader = genOneOf(traders());
        const market = genOneOf(markets());

        const collateral = genOneOf(collaterals());
        const depositAmountDelta = collateral.max.add(bn(1)); // +1 to maxAllowable to exceeded cap.

        await mintAndApprove(bs, collateral, depositAmountDelta, trader.signer);

        await assertRevert(
          BfpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            market.marketId(),
            collateral.address(),
            depositAmountDelta
          ),
          `MaxCollateralExceeded("${depositAmountDelta}", "${collateral.max}")`,
          BfpMarketProxy
        );
      });

      it('should revert deposit that exceeds market-wide max cap', async () => {
        const { BfpMarketProxy } = systems();

        const tradersGenerator = toRoundRobinGenerators(shuffle(traders()));
        const trader1 = tradersGenerator.next().value;
        const trader2 = tradersGenerator.next().value;

        const market = genOneOf(markets());

        const collateral = genOneOf(collaterals());
        const depositAmountDelta1 = collateral.max; // Exactly at cap.
        const depositAmountDelta2 = bn(genNumber(1, 10)); // A few units above cap.

        await mintAndApprove(bs, collateral, depositAmountDelta1, trader1.signer);
        await mintAndApprove(bs, collateral, depositAmountDelta2, trader2.signer);

        await BfpMarketProxy.connect(trader1.signer).modifyCollateral(
          trader1.accountId,
          market.marketId(),
          collateral.address(),
          depositAmountDelta1
        );

        // Exceeded cap (across two accounts and hence market wide).
        await assertRevert(
          BfpMarketProxy.connect(trader2.signer).modifyCollateral(
            trader2.accountId,
            market.marketId(),
            collateral.address(),
            depositAmountDelta2
          ),
          `MaxCollateralExceeded("${depositAmountDelta2}", "${collateral.max}")`,
          BfpMarketProxy
        );
      });

      it('should revert when insufficient amount of collateral in msg.sender', async () => {
        const { BfpMarketProxy } = systems();

        const trader = genOneOf(traders());
        const market = genOneOf(markets());
        const collateral = genOneOf(collaterals());

        // Ensure the amount available is lower than amount to deposit (i.e. depositing more than available).
        const amountToDeposit = bn(genNumber(100, 1000));
        const amountAvailable = amountToDeposit.sub(bn(genNumber(50, 99)));

        await mintAndApprove(bs, collateral, amountAvailable, trader.signer);

        await assertRevert(
          BfpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            market.marketId(),
            collateral.address(),
            amountToDeposit
          ),
          `InsufficientAllowance("${amountToDeposit}", "${amountAvailable}")`,
          collateral.contract
        );
      });

      it('should revert when account is flagged for liquidation', async () => {
        const { BfpMarketProxy } = systems();
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
        await BfpMarketProxy.flagPosition(trader.accountId, marketId);

        // Mint some more collateral.
        await mintAndApprove(bs, collateral, collateralDepositAmount, trader.signer);

        await assertRevert(
          BfpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            marketId,
            collateral.address(),
            collateralDepositAmount
          ),
          `PositionFlagged()`,
          BfpMarketProxy
        );
      });
    });

    describe('withdraw', () => {
      it('should allow full withdraw of collateral from my account', async () => {
        const { BfpMarketProxy } = systems();
        const { trader, traderAddress, marketId, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));

        // Perform the withdraw (full amount).
        const { receipt } = await withExplicitEvmMine(
          () =>
            BfpMarketProxy.connect(trader.signer).modifyCollateral(
              trader.accountId,
              marketId,
              collateral.address(),
              collateralDepositAmount.mul(-1)
            ),
          provider()
        );

        const marginWithdrawEventProperties = [
          `"${BfpMarketProxy.address}"`,
          `"${traderAddress}"`,
          collateralDepositAmount,
          `"${collateral.address()}"`,
        ].join(', ');

        await assertEvent(
          receipt,
          `MarginWithdraw(${marginWithdrawEventProperties})`,
          BfpMarketProxy
        );
      });

      it('should allow withdraw of collateral when collateral maxAllowable is 0', async () => {
        const { BfpMarketProxy } = systems();
        const { trader, traderAddress, marketId, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));
        const configuredCollaterals = await BfpMarketProxy.getMarginCollateralConfiguration();

        await BfpMarketProxy.setMarginCollateralConfiguration(
          configuredCollaterals.map(({ collateralAddress }) => collateralAddress),
          configuredCollaterals.map(({ oracleNodeId }) => oracleNodeId),
          configuredCollaterals.map(({ skewScale }) => skewScale),
          // Set maxAllowable to 0 for all collaterals
          configuredCollaterals.map(() => bn(0)),
          configuredCollaterals.map(({ rewardDistributor }) => rewardDistributor)
        );

        // Perform the withdraw (full amount).
        const { receipt } = await withExplicitEvmMine(
          () =>
            BfpMarketProxy.connect(trader.signer).modifyCollateral(
              trader.accountId,
              marketId,
              collateral.address(),
              collateralDepositAmount.mul(-1)
            ),
          provider()
        );

        const marginWithdrawEventProperties = [
          `"${BfpMarketProxy.address}"`,
          `"${traderAddress}"`,
          collateralDepositAmount,
          `"${collateral.address()}"`,
        ].join(', ');

        await assertEvent(
          receipt,
          `MarginWithdraw(${marginWithdrawEventProperties})`,
          BfpMarketProxy
        );
      });

      it('should allow withdraw when market is in close only', async () => {
        const { BfpMarketProxy } = systems();
        const { collateral, trader, marketId, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs)
        );

        await setMarketConfigurationById(bs, marketId, { maxMarketSize: 0 });
        const { maxMarketSize } = await BfpMarketProxy.getMarketConfigurationById(marketId);
        assertBn.equal(maxMarketSize, bn(0));

        const { receipt: withdrawReceipt } = await withExplicitEvmMine(
          () =>
            BfpMarketProxy.connect(trader.signer).modifyCollateral(
              trader.accountId,
              marketId,
              collateral.address(),
              collateralDepositAmount.mul(-1)
            ),
          provider()
        );

        await assertEvent(withdrawReceipt, 'MarginWithdraw', BfpMarketProxy);
      });

      forEach([
        ['sUSD', () => getSusdCollateral(collaterals())],
        ['non-sUSD', () => genOneOf(collateralsWithoutSusd())],
      ]).it(
        'should emit all events in correct order (%s)',
        async (_, getCollateral: () => PerpCollateral) => {
          const { BfpMarketProxy, Core } = systems();
          const { trader, marketId, collateral, collateralDepositAmount, traderAddress } =
            await depositMargin(bs, genTrader(bs, { desiredCollateral: getCollateral() }));
          const withdrawAmount = wei(collateralDepositAmount).mul(0.5).toBN();

          // Perform the withdraw.
          const { receipt } = await withExplicitEvmMine(
            () =>
              BfpMarketProxy.connect(trader.signer).modifyCollateral(
                trader.accountId,
                marketId,
                collateral.address(),
                withdrawAmount.mul(-1)
              ),
            provider()
          );
          const coreEvents = Core.interface.format(utils.FormatTypes.full) as string[];
          // Create a contract that can parse all events emitted.
          const contractsWithAllEvents = extendContractAbi(
            BfpMarketProxy,
            coreEvents.concat([
              'event Transfer(address indexed from, address indexed to, uint256 value)',
            ])
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
                `MarketUsdWithdrawn\\(${marketId}, "${traderAddress}", ${withdrawAmount}, "${BfpMarketProxy.address}",`
              ), // + tail properties omitted.
            ]);
          } else {
            expectedEvents = expectedEvents.concat([
              `Transfer("${Core.address}", "${BfpMarketProxy.address}", ${withdrawAmount})`, // From collateral ERC20 contract
              new RegExp(
                `MarketCollateralWithdrawn\\(${marketId}, "${collateral.contract.address}", ${withdrawAmount}, "${BfpMarketProxy.address}",`
              ), // From core (+ tail properties omitted)
              `Transfer("${BfpMarketProxy.address}", "${traderAddress}", ${withdrawAmount})`, // From collateral ERC20 contract
            ]);
          }

          const marginWithdrawEventProperties = [
            `"${BfpMarketProxy.address}"`,
            `"${traderAddress}"`,
            withdrawAmount,
            `"${collateral.address()}"`,
          ].join(', ');
          expectedEvents.push(`MarginWithdraw(${marginWithdrawEventProperties})`);

          await assertEvents(receipt, expectedEvents, contractsWithAllEvents);
        }
      );

      it('should allow partial withdraw of collateral to my account', async () => {
        const { BfpMarketProxy } = systems();
        const { trader, traderAddress, marketId, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));

        // Perform the withdraw (partial amount).
        const withdrawAmount = collateralDepositAmount.div(2).mul(-1);
        const { receipt } = await withExplicitEvmMine(
          () =>
            BfpMarketProxy.connect(trader.signer).modifyCollateral(
              trader.accountId,
              marketId,
              collateral.address(),
              withdrawAmount
            ),
          provider()
        );

        const marginWithdrawEventProperties = [
          `"${BfpMarketProxy.address}"`,
          `"${traderAddress}"`,
          withdrawAmount.abs(), // Convert to positive because `Transfer` takes in abs(amount).
          `"${collateral.address()}"`,
        ].join(', ');

        await assertEvent(
          receipt,
          `MarginWithdraw(${marginWithdrawEventProperties})`,
          BfpMarketProxy
        );
      });

      it('should allow partial withdraw when initial margin req are still met', async () => {
        const { BfpMarketProxy } = systems();
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
        // Payback debt for fees
        await payDebt(bs, marketId, trader);

        const { im, remainingMarginUsd } = await BfpMarketProxy.getPositionDigest(
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
            BfpMarketProxy.connect(trader.signer).modifyCollateral(
              trader.accountId,
              marketId,
              collateral.address(),
              withdrawAmount.mul(-1).toBN()
            ),
          provider()
        );
        const marginWithdrawEventProperties = [
          `"${BfpMarketProxy.address}"`,
          `"${traderAddress}"`,
          withdrawAmount.toBN(),
          `"${collateral.address()}"`,
        ].join(', ');
        await assertEvent(
          receipt,
          `MarginWithdraw(${marginWithdrawEventProperties})`,
          BfpMarketProxy
        );

        const expectedBalanceAfter = wei(balanceBefore).add(withdrawAmount).toBN();
        const balanceAfter = await collateral.contract.balanceOf(traderAddress);
        assertBn.equal(expectedBalanceAfter, balanceAfter);
      });

      it('should revert withdraw to an account that does not exist', async () => {
        const { BfpMarketProxy } = systems();
        const { trader, marketId, collateral, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs)
        );
        const invalidAccountId = bn(genNumber(42069, 50_000));

        // Perform withdraw with zero address.
        await assertRevert(
          BfpMarketProxy.connect(trader.signer).modifyCollateral(
            invalidAccountId,
            marketId,
            collateral.address(),
            collateralDepositAmount.mul(-1)
          ),
          `PermissionDenied("${invalidAccountId}"`,
          BfpMarketProxy
        );
      });

      it('should revert withdraw from market that does not exist', async () => {
        const { BfpMarketProxy } = systems();
        const { trader, collateral, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs)
        );
        const invalidMarketId = bn(genNumber(42069, 50_000));

        // Perform withdraw with zero address.
        await assertRevert(
          BfpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            invalidMarketId,
            collateral.address(),
            collateralDepositAmount.mul(-1)
          ),
          `MarketNotFound("${invalidMarketId}")`,
          BfpMarketProxy
        );
      });

      it('should revert withdraw of unsupported collateral', async () => {
        const { BfpMarketProxy } = systems();
        const { trader, marketId, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs)
        );
        const invalidCollateral = genAddress();

        // Perform withdraw with invalid synth market id.
        await assertRevert(
          BfpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            marketId,
            invalidCollateral,
            collateralDepositAmount.mul(-1)
          ),
          `UnsupportedCollateral("${invalidCollateral}")`,
          BfpMarketProxy
        );
      });

      it('should revert withdraw of more than what is available', async () => {
        const { BfpMarketProxy } = systems();
        const { trader, marketId, collateral, collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs)
        );

        // Perform the withdraw with a little more than what was deposited.
        const withdrawAmount = collateralDepositAmount.add(bn(1)).mul(-1);

        const insufficientCollateralEventProperties = [
          `"${collateral.address()}"`,
          `"${collateralDepositAmount}"`,
          `"${withdrawAmount.mul(-1)}"`,
        ].join(', ');

        await assertRevert(
          BfpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            marketId,
            collateral.address(),
            withdrawAmount
          ),
          `InsufficientCollateral(${insufficientCollateralEventProperties})`,
          BfpMarketProxy
        );
      });

      it('should revert withdraw when margin below im', async () => {
        const { BfpMarketProxy } = systems();
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

        // Payback debt for fees
        await payDebt(bs, marketId, trader);

        const { im, remainingMarginUsd } = await BfpMarketProxy.getPositionDigest(
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
          BfpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            marketId,
            collateral.address(),
            amountToWithdraw.mul(-1).toBN()
          ),
          `InsufficientMargin()`,
          BfpMarketProxy
        );
      });

      it('should revert when user has debt', async () => {
        const { BfpMarketProxy } = systems();

        const trader = genOneOf(traders());
        const accountId = trader.accountId;
        const collateral = genOneOf(collateralsWithoutSusd());

        // Market ETH-PERP and set price at $3500
        const market = genOneOf(markets());
        const marketId = market.marketId();
        await market.aggregator().mockSetCurrentPrice(bn(3500)); // market.getOraclePrice()

        const { collateralDepositAmount } = await depositMargin(
          bs,
          genTrader(bs, {
            desiredMarginUsdDepositAmount: 1000,
            desiredCollateral: collateral,
            desiredTrader: trader,
            desiredMarket: market,
          })
        );

        const openOrder = await genOrder(bs, market, collateral, collateralDepositAmount.div(2), {
          desiredLeverage: 8,
          desiredSide: 1,
        });
        await commitAndSettle(bs, marketId, trader, openOrder);

        // Set market price to be at a loss.
        await market.aggregator().mockSetCurrentPrice(bn(3300));

        // Close order so we now have some debt
        const closeOrder = await genOrderFromSizeDelta(bs, market, openOrder.sizeDelta.mul(-1));
        await commitAndSettle(bs, marketId, trader, closeOrder);

        // Attempt to withdraw all collateral even though there's debt on the account.
        await assertRevert(
          BfpMarketProxy.connect(trader.signer).modifyCollateral(
            accountId,
            marketId,
            collateral.address(),
            bn(-1)
          ),
          `DebtFound("${trader.accountId}", "${marketId}")`,
          BfpMarketProxy
        );
      });

      it('should revert withdraw if places position into liquidation', async () => {
        const { BfpMarketProxy } = systems();
        const { trader, marketId, market, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));
        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredSide: -1,
          desiredLeverage: 7,
        });

        // Open leveraged position
        await commitAndSettle(bs, marketId, trader, order);

        // Payback debt for order fees
        await payDebt(bs, marketId, trader);

        await assertRevert(
          BfpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            marketId,
            collateral.address(),
            wei(collateralDepositAmount).mul(-0.9).toBN()
          ),
          `CanLiquidatePosition()`,
          BfpMarketProxy
        );
      });

      it('should revert withdraw if position is liquidatable due to price', async () => {
        const { BfpMarketProxy } = systems();
        const { trader, marketId, market, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));
        const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
          desiredSide: -1,
          desiredLeverage: 10,
        });

        // Open leveraged position.
        await commitAndSettle(bs, marketId, trader, order);
        // Payback debt for order fees
        await payDebt(bs, marketId, trader);

        // Change market price to make position liquidatable.
        await market.aggregator().mockSetCurrentPrice(wei(order.oraclePrice).mul(2).toBN());

        await assertRevert(
          BfpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            marketId,
            collateral.address(),
            bn(-0.01)
          ),
          `CanLiquidatePosition()`,
          BfpMarketProxy
        );
      });

      it('should revert when account is flagged for liquidation', async () => {
        const { BfpMarketProxy } = systems();
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
        await BfpMarketProxy.flagPosition(trader.accountId, marketId);

        await assertRevert(
          BfpMarketProxy.connect(trader.signer).modifyCollateral(
            trader.accountId,
            marketId,
            collateral.address(),
            collateralDepositAmount.mul(-1)
          ),
          `PositionFlagged()`,
          BfpMarketProxy
        );
      });
    });

    describe('withdrawAllCollateral', () => {
      it('should withdraw all account collateral', async () => {
        const { BfpMarketProxy } = systems();

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
        const accountDigest = await BfpMarketProxy.getAccountDigest(trader.accountId, marketId);

        const { available: collateralBalance = bn(0) } =
          accountDigest.depositedCollaterals.find(
            ({ collateralAddress }) => collateralAddress === collateral.address()
          ) || {};
        const { available: collateral2Balance = bn(0) } =
          accountDigest.depositedCollaterals.find(
            ({ collateralAddress }) => collateralAddress === collateral2.address()
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
            BfpMarketProxy.connect(trader.signer).withdrawAllCollateral(trader.accountId, marketId),
          provider()
        );

        // Assert that events are triggered.
        await assertEvent(
          receipt,
          `MarginWithdraw("${
            BfpMarketProxy.address
          }", "${traderAddress}", ${collateralDepositAmount}, "${collateral.address()}")`,
          BfpMarketProxy
        );
        await assertEvent(
          receipt,
          `MarginWithdraw("${
            BfpMarketProxy.address
          }", "${traderAddress}", ${collateralDepositAmount2}, "${collateral2.address()}")`,
          BfpMarketProxy
        );

        // Assert that no collateral is left the market
        const accountDigestAfter = await BfpMarketProxy.getAccountDigest(
          trader.accountId,
          marketId
        );
        const { available: collateralBalanceAfter = bn(0) } =
          accountDigestAfter.depositedCollaterals.find(
            ({ collateralAddress }) => collateralAddress === collateral.address()
          ) || {};
        const { available: collateral2BalanceAfter = bn(0) } =
          accountDigestAfter.depositedCollaterals.find(
            ({ collateralAddress }) => collateralAddress === collateral2.address()
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
        const { BfpMarketProxy } = systems();
        const { trader, traderAddress, marketId, collateral, collateralDepositAmount } =
          await depositMargin(bs, genTrader(bs));

        const configuredCollaterals = await BfpMarketProxy.getMarginCollateralConfiguration();
        await BfpMarketProxy.setMarginCollateralConfiguration(
          configuredCollaterals.map(({ collateralAddress }) => collateralAddress),
          configuredCollaterals.map(({ oracleNodeId }) => oracleNodeId),
          configuredCollaterals.map(({ skewScale }) => skewScale),
          // Set maxAllowable to 0 for all collaterals.
          configuredCollaterals.map(() => bn(0)),
          configuredCollaterals.map(({ rewardDistributor }) => rewardDistributor)
        );

        // Perform the withdraw (full amount).
        const { receipt } = await withExplicitEvmMine(
          () =>
            BfpMarketProxy.connect(trader.signer).withdrawAllCollateral(trader.accountId, marketId),
          provider()
        );

        const marginWithdrawEventProperties = [
          `"${BfpMarketProxy.address}"`,
          `"${traderAddress}"`,
          collateralDepositAmount,
          `"${collateral.address()}"`,
        ].join(', ');

        await assertEvent(
          receipt,
          `MarginWithdraw(${marginWithdrawEventProperties})`,
          BfpMarketProxy
        );
      });

      it('should allow withdrawing all when market is in close only', async () => {
        const { BfpMarketProxy } = systems();
        const { trader, marketId } = await depositMargin(bs, genTrader(bs));
        await setMarketConfigurationById(bs, marketId, { maxMarketSize: 0 });
        const { maxMarketSize } = await BfpMarketProxy.getMarketConfigurationById(marketId);
        assertBn.equal(maxMarketSize, bn(0));
        // We should be able to withdraw
        const { receipt: withdrawReceipt } = await withExplicitEvmMine(
          () =>
            BfpMarketProxy.connect(trader.signer).withdrawAllCollateral(trader.accountId, marketId),
          provider()
        );

        await assertEvent(withdrawReceipt, 'MarginWithdraw', BfpMarketProxy);
      });

      it('should revert withdrawingAll if pending order exists and expired', async () => {
        const { BfpMarketProxy } = systems();
        const { collateral, market, marketId, collateralDepositAmount, trader } =
          await depositMargin(bs, genTrader(bs));

        const order = await genOrder(bs, market, collateral, collateralDepositAmount);
        await commitOrder(bs, marketId, trader, order);

        // Make the order expired
        const { expireTime } = await getFastForwardTimestamp(bs, marketId, trader);
        await fastForwardTo(expireTime + 10, provider());

        await assertRevert(
          BfpMarketProxy.connect(trader.signer).withdrawAllCollateral(trader.accountId, marketId),
          'OrderFound()',
          BfpMarketProxy
        );
      });

      it('should recompute funding', async () => {
        const { BfpMarketProxy } = systems();
        const { trader, market } = await depositMargin(bs, genTrader(bs));

        // Execute withdrawAllCollateral.
        const { receipt } = await withExplicitEvmMine(
          () =>
            BfpMarketProxy.connect(trader.signer).withdrawAllCollateral(
              trader.accountId,
              market.marketId()
            ),
          provider()
        );
        await assertEvent(receipt, `FundingRecomputed()`, BfpMarketProxy);
      });

      it('should withdraw with fees and funding removed when no price changes', async () => {
        const { BfpMarketProxy } = systems();
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
        const openOrderEvent = findEventSafe(openReceipt, 'OrderSettled', BfpMarketProxy);
        const closeOrderEvent = findEventSafe(closeReceipt, 'OrderSettled', BfpMarketProxy);

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
        await BfpMarketProxy.connect(trader.signer).withdrawAllCollateral(
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
          const { BfpMarketProxy, USD } = systems();
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
          const openOrderEvent = findEventSafe(openReceipt, 'OrderSettled', BfpMarketProxy);
          const closeOrderEvent = findEventSafe(closeReceipt, 'OrderSettled', BfpMarketProxy);

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
          await BfpMarketProxy.connect(trader.signer).withdrawAllCollateral(
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
          assertBn.near(await BfpMarketProxy.reportedDebt(marketId), bn(0), bn(0.000001));
        }
      );

      it('should withdraw correct amounts after losing position (sUSD)', async () => {
        const { BfpMarketProxy } = systems();

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
          findEventSafe(closeReceipt, 'OrderSettled', BfpMarketProxy) || {};
        const { args: openEventArgs } =
          findEventSafe(openReceipt, 'OrderSettled', BfpMarketProxy) || {};
        const pnl = calcPricePnl(openOrder.sizeDelta, closeOrder.fillPrice, openOrder.fillPrice);
        const openOrderFees = wei(openOrder.orderFee).add(openEventArgs?.keeperFee);
        const closeOrderFees = wei(closeOrder.orderFee).add(closeEventArgs?.keeperFee);
        const totalPnl = wei(pnl)
          .sub(openOrderFees)
          .sub(closeOrderFees)
          .add(closeEventArgs?.accruedFunding)
          .sub(closeEventArgs.accruedUtilization);

        await BfpMarketProxy.connect(trader.signer).withdrawAllCollateral(
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
        const { BfpMarketProxy, Core } = systems();

        await setMarketConfiguration(bs, {
          maxCollateralDiscount: bn(0),
          minCollateralDiscount: bn(0),
        });

        // NOTE: Collateral skewScale _must_ be set to zero here as its too difficult to calculate exact values from
        // an implicit skewFee applied on the collateral sale.
        const newCollaterals = collaterals();
        await withExplicitEvmMine(
          () =>
            BfpMarketProxy.setMarginCollateralConfiguration(
              newCollaterals.map(({ address }) => address()),
              newCollaterals.map(({ oracleNodeId }) => oracleNodeId()),
              newCollaterals.map(({ max }) => max),
              newCollaterals.map(() => bn(0)),
              newCollaterals.map(({ rewardDistributorAddress }) => rewardDistributorAddress())
            ),
          provider()
        );

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
          findEventSafe(openReceipt, 'OrderSettled', BfpMarketProxy) || {};

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
          findEventSafe(closeReceipt, 'OrderSettled', BfpMarketProxy) || {};

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
        const { debtUsd } = await BfpMarketProxy.getAccountDigest(trader.accountId, marketId);

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
        const coreAbi = Core.interface.format(utils.FormatTypes.full) as string[];
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
              `MarketUsdWithdrawn\\(${marketId}, "${keeperAddress}", ${closeEventArgs?.keeperFee}, "${BfpMarketProxy.address}",`
            ), // Withdraw sUSD to pay keeper, note here that this amount is covered by the traders losses, so this amount will be included in MarketUsdDeposited (+ tail properties omitted)
            `OrderSettled(${orderSettledEventArgs})`,
            `MarketSizeUpdated(${marketId}, 0, 0)`,
          ],

          // PerpsMarket abi gets events from Core, SpotMarket, Pyth and ERC20 added
          extendContractAbi(
            BfpMarketProxy,
            coreAbi.concat([
              'event Transfer(address indexed from, address indexed to, uint256 value)', //ERC20
              'event PriceFeedUpdate(bytes32 indexed id, uint64 publishTime, int64 price, uint64 conf)', // Pyth
              'event BatchPriceFeedUpdate(uint16 chainId, uint64 sequenceNumber)', // Pyth
            ])
          )
        );

        // Note: payDebt will mint the sUSD.
        await payDebt(bs, marketId, trader);

        // Actually do the withdraw.
        await BfpMarketProxy.connect(trader.signer).withdrawAllCollateral(
          trader.accountId,
          marketId
        );

        const balanceAfterTrade = await collateral.contract.balanceOf(traderAddress);

        // We expect to be losing.
        assertBn.lt(collateralDiffAmount.toBN(), bn(0));

        // Since the `payDebt` minted the usd, we expect the balance to be the same as the starting balance.
        assertBn.near(startingCollateralBalance.toBN(), balanceAfterTrade, bn(0.0001));

        // Everything has been withdrawn. There should be no reportedDebt for this market.
        assertBn.near(await BfpMarketProxy.reportedDebt(marketId), bn(0), bn(0.00001));
      });

      it(
        'should revert with InsufficientMarketCollateralWithdrawable from synthetix.MarketCollateralModule'
      );

      it('should revert when account has no collateral to withdraw', async () => {
        const { BfpMarketProxy } = systems();
        const { trader, marketId } = await genTrader(bs);

        await assertRevert(
          BfpMarketProxy.connect(trader.signer).withdrawAllCollateral(trader.accountId, marketId),
          `NilCollateral()`,
          BfpMarketProxy
        );
      });

      it('should revert when account does not exist', async () => {
        const { BfpMarketProxy } = systems();
        const { trader, marketId } = await depositMargin(bs, genTrader(bs));
        const invalidAccountId = bn(genNumber(42069, 50_000));

        // Perform withdraw with invalid account
        await assertRevert(
          BfpMarketProxy.connect(trader.signer).withdrawAllCollateral(invalidAccountId, marketId),
          `PermissionDenied("${invalidAccountId}"`,
          BfpMarketProxy
        );
      });

      it('should revert when market does not exist', async () => {
        const { BfpMarketProxy } = systems();
        const { trader } = await depositMargin(bs, genTrader(bs));
        const invalidMarketId = bn(genNumber(42069, 50_000));

        // Perform withdraw with invalid market
        await assertRevert(
          BfpMarketProxy.connect(trader.signer).withdrawAllCollateral(
            trader.accountId,
            invalidMarketId
          ),
          `MarketNotFound("${invalidMarketId}")`,
          BfpMarketProxy
        );
      });

      it('should revert when trader has a pending order', async () => {
        const { BfpMarketProxy } = systems();
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
          BfpMarketProxy.connect(trader.signer).withdrawAllCollateral(trader.accountId, marketId),
          `OrderFound()`,
          BfpMarketProxy
        );
      });

      it('should revert when trader has an open position', async () => {
        const { BfpMarketProxy } = systems();
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
          BfpMarketProxy.connect(trader.signer).withdrawAllCollateral(trader.accountId, marketId),
          `PositionFound("${trader.accountId}", "${marketId}")`,
          BfpMarketProxy
        );
      });

      it('should revert when trader has debt', async () => {
        const { BfpMarketProxy } = systems();
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
          BfpMarketProxy.connect(trader.signer).withdrawAllCollateral(trader.accountId, marketId),
          `DebtFound("${trader.accountId}", "${marketId}")`,
          BfpMarketProxy
        );
      });

      it('should revert when withdrawing all collateral of another account', async () => {
        const { BfpMarketProxy } = systems();

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
          BfpMarketProxy.connect(trader2.signer).withdrawAllCollateral(
            trader1.accountId,
            market.marketId()
          ),
          `PermissionDenied("${trader1.accountId}", "${permission}", "${signerAddress}")`,
          BfpMarketProxy
        );
      });

      it('should revert when flagged', async () => {
        const { BfpMarketProxy } = systems();
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
        await BfpMarketProxy.flagPosition(trader.accountId, marketId);
        await assertRevert(
          BfpMarketProxy.connect(trader.signer).withdrawAllCollateral(trader.accountId, marketId),
          `PositionFlagged()`,
          BfpMarketProxy
        );
      });
    });
  });

  describe('setMarginMarginCollateralConfiguration', () => {
    it('should revert when config arrays has mismatched lengths', async () => {
      const { BfpMarketProxy } = systems();
      const from = owner();

      const collateralAddresses = [collaterals()[0].address(), collaterals()[1].address()];
      const maxAllowables = genListOf(genNumber(3, 10), () => bn(genNumber(10_000, 100_000)));
      const skewScales = genListOf(genNumber(3, 10), () => bn(genNumber(10_000, 100_000)));
      const oracleNodeIds = genListOf(genNumber(3, 10), () => genBytes32());
      const rewardDistributors = genListOf(genNumber(3, 10), () => genAddress());

      await assertRevert(
        BfpMarketProxy.connect(from).setMarginCollateralConfiguration(
          collateralAddresses,
          oracleNodeIds,
          maxAllowables,
          skewScales,
          rewardDistributors
        ),
        `ArrayLengthMismatch()`,
        BfpMarketProxy
      );
    });

    it('should configure and return many collaterals configured', async () => {
      const { BfpMarketProxy } = systems();
      const from = owner();

      const newCollaterals = shuffle(collaterals());
      const newCollateralAddresses = newCollaterals.map(({ address }) => address());
      const newOracleNodeIds = genListOf(newCollaterals.length, () => genBytes32());
      const newMaxAllowables = genListOf(newCollaterals.length, () =>
        bn(genNumber(10_000, 100_000))
      );
      const newSkewScales = genListOf(newCollaterals.length, () => bn(genNumber(10_000, 100_000)));
      const newRewardDistributors = newCollaterals.map(({ rewardDistributorAddress }) =>
        rewardDistributorAddress()
      );

      const { receipt } = await withExplicitEvmMine(
        () =>
          BfpMarketProxy.connect(from).setMarginCollateralConfiguration(
            newCollateralAddresses,
            newOracleNodeIds,
            newMaxAllowables,
            newSkewScales,
            newRewardDistributors
          ),
        provider()
      );
      const configuredCollaterals = await BfpMarketProxy.getMarginCollateralConfiguration();

      assert.equal(configuredCollaterals.length, newCollaterals.length);

      for (const [_i, configuredCollateral] of Object.entries(configuredCollaterals)) {
        const idx = parseInt(_i);
        const { contract: synth } = newCollaterals[idx];

        const coreAllowance = await synth.allowance(
          BfpMarketProxy.address,
          bs.systems().Core.address
        );
        assertBn.equal(ethers.constants.MaxUint256, coreAllowance);
        assertBn.equal(configuredCollateral.maxAllowable, newMaxAllowables[idx]);
      }

      await assertEvent(
        receipt,
        `MarginCollateralConfigured("${await from.getAddress()}", ${newCollaterals.length})`,
        BfpMarketProxy
      );
    });

    it('should remove an unsupported collateral when set with new collaterals', async () => {
      const { BfpMarketProxy, Core } = systems();
      const from = owner();

      // Set a known set of supported collaterals.
      const supportedCollaterals = collaterals();
      const collaterals1 = collaterals().map(({ address }) => address());
      const oracleNodeIds1 = collaterals().map(({ oracleNodeId }) => oracleNodeId());
      const maxAllowables1 = collaterals().map(() => bn(1));
      const skewScales1 = collaterals().map(({ skewScale }) => skewScale());
      const rewardDistributors1 = collaterals().map(({ rewardDistributorAddress }) =>
        rewardDistributorAddress()
      );

      await BfpMarketProxy.connect(from).setMarginCollateralConfiguration(
        collaterals1,
        oracleNodeIds1,
        maxAllowables1,
        skewScales1,
        rewardDistributors1
      );

      // Reconfigure the collaterals, removing one of them.
      const collateral2 = [
        supportedCollaterals[0].address(),
        // supportedCollaterals[1].address(), (removed!)
      ];
      const oracleNodeIds2 = [genBytes32()];
      const maxAllowables2 = [bn(1)];
      const skewScales2 = [bn(1)];
      const rewardDistributors2 = [supportedCollaterals[0].rewardDistributorAddress()];

      await BfpMarketProxy.connect(from).setMarginCollateralConfiguration(
        collateral2,
        oracleNodeIds2,
        maxAllowables2,
        skewScales2,
        rewardDistributors2
      );

      const configuredCollaterals = await BfpMarketProxy.getMarginCollateralConfiguration();
      const removedCollateral = supportedCollaterals[1];

      const perpAllowance = await removedCollateral.contract.allowance(
        BfpMarketProxy.address,
        BfpMarketProxy.address
      );
      const coreAllowance = await removedCollateral.contract.allowance(
        BfpMarketProxy.address,
        Core.address
      );

      assertBn.isZero(perpAllowance);
      assertBn.isZero(coreAllowance);
      assert.equal(configuredCollaterals.length, 1);
      assert.equal(
        configuredCollaterals.filter(
          ({ collateralAddress }) => collateralAddress === removedCollateral.address()
        ).length,
        0
      );
    });

    it('should allow zero maxAllowables to disable deposits', async () => {
      const { BfpMarketProxy } = systems();
      const from = owner();

      // Set zero allowable deposits.
      const supportedCollaterals = collaterals();
      const collateralAddresses = [
        supportedCollaterals[0].address(),
        supportedCollaterals[1].address(),
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
      const skewScales = [supportedCollaterals[0].skewScale(), supportedCollaterals[1].skewScale()];

      // Ensure we can set maxAllowables to 0 even when there's collateral in the system.
      await depositMargin(bs, genTrader(bs, { desiredCollateral: supportedCollaterals[0] }));

      await BfpMarketProxy.connect(from).setMarginCollateralConfiguration(
        collateralAddresses,
        oracleNodeIds,
        maxAllowables,
        skewScales,
        rewardDistributors
      );

      const configuredCollaterals =
        await BfpMarketProxy.connect(from).getMarginCollateralConfiguration();
      assertBn.isZero(configuredCollaterals[0].maxAllowable);
      assertBn.isZero(configuredCollaterals[1].maxAllowable);
    });

    it('should revert when removal of collateral with amounts in the system', async () => {
      const { BfpMarketProxy } = systems();
      const from = owner();

      const supportedCollaterals = shuffle(collaterals());
      const { collateral } = await depositMargin(
        bs,
        genTrader(bs, { desiredCollateral: genOneOf(supportedCollaterals) })
      );

      // Excluding "collateral" with deposit and expect revert.
      const collateralsWithoutDeposit = supportedCollaterals.filter(
        ({ address }) => address() !== collateral.address()
      );

      const collateralAddresses = collateralsWithoutDeposit.map(({ address }) => address());
      const oracleNodeIds = collateralsWithoutDeposit.map(({ oracleNodeId }) => oracleNodeId());
      const maxAllowables = collateralsWithoutDeposit.map(() => bn(0));
      const skewScales = collateralsWithoutDeposit.map(({ skewScale }) => skewScale());
      const rewardDistributors = collateralsWithoutDeposit.map(({ rewardDistributorAddress }) =>
        rewardDistributorAddress()
      );

      await assertRevert(
        BfpMarketProxy.connect(from).setMarginCollateralConfiguration(
          collateralAddresses,
          oracleNodeIds,
          maxAllowables,
          skewScales,
          rewardDistributors
        ),
        `MissingRequiredCollateral("${collateral.address()}")`,
        BfpMarketProxy
      );
    });

    it('should allow removal of collateral with no amounts in the system', async () => {
      const { BfpMarketProxy } = systems();
      const from = owner();

      // Set zero allowable deposits.
      const supportedCollaterals = collaterals();

      // Excluding supportedCollaterals[0].address(), which has a deposit.
      const collateralAddresses = [supportedCollaterals[1].address()];
      const oracleNodeIds = [genBytes32()];
      const maxAllowables = [bn(0)];
      const skewScales = [supportedCollaterals[1].skewScale()];
      const rewardDistributors = [supportedCollaterals[1].rewardDistributorAddress()];

      await BfpMarketProxy.connect(from).setMarginCollateralConfiguration(
        collateralAddresses,
        oracleNodeIds,
        maxAllowables,
        skewScales,
        rewardDistributors
      );
      const configuredCollaterals =
        await BfpMarketProxy.connect(from).getMarginCollateralConfiguration();
      assert.equal(configuredCollaterals.length, 1);
    });

    it('should reset existing collaterals when new config is empty', async () => {
      const { BfpMarketProxy } = systems();
      const from = owner();

      await BfpMarketProxy.connect(from).setMarginCollateralConfiguration([], [], [], [], []);
      const collaterals = await BfpMarketProxy.getMarginCollateralConfiguration();

      assert.equal(collaterals.length, 0);
    });

    it('should revert when non-owner', async () => {
      const { BfpMarketProxy } = systems();
      const from = await traders()[0].signer.getAddress();
      await assertRevert(
        BfpMarketProxy.connect(from).setMarginCollateralConfiguration([], [], [], [], []),
        `Unauthorized("${from}")`,
        BfpMarketProxy
      );
    });

    it('should revert when max allowable is negative', async () => {
      const { BfpMarketProxy } = systems();
      const from = owner();
      await assertRevert(
        BfpMarketProxy.connect(from).setMarginCollateralConfiguration(
          [genAddress()],
          [],
          [bn(-1)],
          [],
          [collaterals()[0].rewardDistributorAddress()]
        ),
        'Error: value out-of-bounds',
        BfpMarketProxy
      );
    });

    it('should revert when an collateralAddress is supplied as collateral', async () => {
      const { BfpMarketProxy } = systems();
      const from = owner();

      const collateralAddresses = [genAddress()];
      const oracleNodeIds = [genBytes32()];
      const maxAllowables = [BigNumber.from(1)];
      const skewScales = [BigNumber.from(1)];
      const rewardDistributors = [genOneOf(collaterals()).rewardDistributorAddress()];

      await assertRevert(
        BfpMarketProxy.connect(from).setMarginCollateralConfiguration(
          collateralAddresses,
          oracleNodeIds,
          maxAllowables,
          skewScales,
          rewardDistributors
        ),
        `transaction reverted in contract unknown: 0x`,
        BfpMarketProxy
      );
    });

    it('should revert when a reward distributor address does not support interface', async () => {
      const { BfpMarketProxy } = systems();
      const from = owner();

      const collateral = genOneOf(collateralsWithoutSusd());
      const rewardDistributor = genAddress();

      const collateralAddresses = [collateral.address()];
      const oracleNodeIds = [genBytes32()];
      const maxAllowables = [bn(0)];
      const skewScales = [bn(0)];
      const rewardDistributors = [rewardDistributor];

      await assertRevert(
        BfpMarketProxy.connect(from).setMarginCollateralConfiguration(
          collateralAddresses,
          oracleNodeIds,
          maxAllowables,
          skewScales,
          rewardDistributors
        ),
        `InvalidRewardDistributor("${rewardDistributor}")`,
        BfpMarketProxy
      );
    });

    it('should revert when a reward distributor for sUSD is not 0x0', async () => {
      const { BfpMarketProxy } = systems();
      const from = owner();

      const collateral = getSusdCollateral(collaterals());
      const rewardDistributor = genAddress();

      const collateralAddresses = [collateral.address()];
      const oracleNodeIds = [genBytes32()];
      const maxAllowables = [bn(0)];
      const skewScales = [bn(0)];
      const rewardDistributors = [rewardDistributor];

      await assertRevert(
        BfpMarketProxy.connect(from).setMarginCollateralConfiguration(
          collateralAddresses,
          oracleNodeIds,
          maxAllowables,
          skewScales,
          rewardDistributors
        ),
        `InvalidRewardDistributor("${rewardDistributor}")`,
        BfpMarketProxy
      );
    });

    it('should revert the number of collaterals exceed maximum', async () => {
      const { BfpMarketProxy } = systems();
      const from = owner();

      // Hardcoded system maximum. This must also change if the system changes.
      const MAX_SUPPORTED_MARGIN_COLLATERALS = 10;

      const collateralsToConfigure = MAX_SUPPORTED_MARGIN_COLLATERALS + genNumber(1, 5);

      const newCollaterals = genListOf(collateralsToConfigure, () => genOneOf(collaterals()));
      const newCollateralAddresses = newCollaterals.map(({ address }) => address());
      const newOracleNodeIds = genListOf(newCollaterals.length, () => genBytes32());
      const newMaxAllowables = genListOf(newCollaterals.length, () =>
        bn(genNumber(10_000, 100_000))
      );
      const newSkewScales = genListOf(newCollaterals.length, () => bn(genNumber(10_000, 100_000)));
      const newRewardDistributors = newCollaterals.map(({ rewardDistributorAddress }) =>
        rewardDistributorAddress()
      );

      await assertRevert(
        BfpMarketProxy.connect(from).setMarginCollateralConfiguration(
          newCollateralAddresses,
          newOracleNodeIds,
          newMaxAllowables,
          newSkewScales,
          newRewardDistributors
        ),
        `MaxCollateralExceeded("${collateralsToConfigure}", "${MAX_SUPPORTED_MARGIN_COLLATERALS}")`,
        BfpMarketProxy
      );
    });

    it('should revoke/approve collateral with 0/maxUint');
  });

  describe('setCollateralMaxAllowable', () => {
    it('should revert when max allowable is negative', async () => {
      const { BfpMarketProxy } = systems();

      const from = owner();
      const { address } = genOneOf(collaterals());

      await assertRevert(
        BfpMarketProxy.connect(from).setCollateralMaxAllowable(address(), bn(-1)),
        'Error: value out-of-bounds',
        BfpMarketProxy
      );
    });

    it('should revert when non-owner', async () => {
      const { BfpMarketProxy } = systems();

      const from = await traders()[0].signer.getAddress();
      await assertRevert(
        BfpMarketProxy.connect(from).setCollateralMaxAllowable(genAddress(), bn(0)),
        `Unauthorized("${from}")`,
        BfpMarketProxy
      );
    });

    it('should revert when invalid collateralId', async () => {
      const { BfpMarketProxy } = systems();

      const from = owner();
      const invalidCollateralAddress = genAddress();

      await assertRevert(
        BfpMarketProxy.connect(from).setCollateralMaxAllowable(invalidCollateralAddress, bn(0)),
        `UnsupportedCollateral("${invalidCollateralAddress}")`,
        BfpMarketProxy
      );
    });

    forEach([bn(0), bn(genNumber(20_000, 30_000)), bn(genNumber(30_001, 50_000))]).it(
      `should update max allowable for '%s'`,
      async (newMaxAllowable) => {
        const { BfpMarketProxy } = systems();
        const from = owner();

        const collateral = genOneOf(collaterals());

        const { maxAllowable: maxAllowableBefore } = findOrThrow(
          await BfpMarketProxy.getMarginCollateralConfiguration(),
          ({ collateralAddress }) => collateralAddress === collateral.address()
        );

        assertBn.gt(maxAllowableBefore, bn(0));

        await BfpMarketProxy.connect(from).setCollateralMaxAllowable(
          collateral.address(),
          newMaxAllowable
        );
        const configuredCollateral = await BfpMarketProxy.getMarginCollateralConfiguration();

        const { maxAllowable: maxAllowableAfter } = findOrThrow(
          configuredCollateral,
          ({ collateralAddress }) => collateralAddress === collateral.address()
        );
        assertBn.equal(maxAllowableAfter, newMaxAllowable);
      }
    );
  });

  describe('getMarginDigest', () => {
    it('should revert when accountId does not exist', async () => {
      const { BfpMarketProxy } = systems();
      const { marketId } = await genTrader(bs);
      const invalidAccountId = 42069;

      await assertRevert(
        BfpMarketProxy.getMarginDigest(invalidAccountId, marketId),
        `AccountNotFound("${invalidAccountId}")`,
        BfpMarketProxy
      );
    });

    it('should revert when marketId does not exist', async () => {
      const { BfpMarketProxy } = systems();
      const { trader } = await genTrader(bs);
      const invalidMarketId = 42069;

      await assertRevert(
        BfpMarketProxy.getMarginDigest(trader.accountId, invalidMarketId),
        `MarketNotFound("${invalidMarketId}")`,
        BfpMarketProxy
      );
    });

    describe('collateralUsd', () => {
      it('should return the usd amount in collateral', async () => {
        const { BfpMarketProxy } = systems();
        const { trader, marketId, marginUsdDepositAmount } = await depositMargin(bs, genTrader(bs));

        await setMarketConfiguration(bs, {
          minCollateralDiscount: bn(0),
          maxCollateralDiscount: bn(0),
        });
        const { collateralUsd } = await BfpMarketProxy.getMarginDigest(trader.accountId, marketId);
        assertBn.near(collateralUsd, marginUsdDepositAmount);
      });

      it('should return usd amount after price of collateral changes (non-usd)', async () => {
        const { BfpMarketProxy } = systems();

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
        const { collateralUsd: collateralUsdBefore } = await BfpMarketProxy.getMarginDigest(
          trader.accountId,
          marketId
        );

        assertBn.near(collateralUsdBefore, marginUsdDepositAmount);

        // Change price.
        const newCollateralPrice = wei(collateralPrice).mul(2).toBN();
        await collateral.setPrice(newCollateralPrice);
        const { collateralUsd } = await BfpMarketProxy.getMarginDigest(trader.accountId, marketId);
        const expected = wei(collateralDepositAmount).mul(newCollateralPrice).toBN();

        assertBn.equal(collateralUsd, expected);
      });

      it('should return zero when collateral has not been deposited', async () => {
        const { BfpMarketProxy } = systems();
        const { trader, marketId } = await genTrader(bs);
        const { collateralUsd } = await BfpMarketProxy.getMarginDigest(trader.accountId, marketId);

        assertBn.isZero(collateralUsd);
      });
    });

    describe('marginUsd', () => {
      it('should return marginUsd that reflects value of collateral when no positions opened', async () => {
        const { BfpMarketProxy } = systems();
        const { trader, marketId, collateralDepositAmount, collateralPrice } = await depositMargin(
          bs,
          genTrader(bs)
        );

        await setMarketConfiguration(bs, {
          maxCollateralDiscount: bn(0),
          minCollateralDiscount: bn(0),
        });

        const { marginUsd } = await BfpMarketProxy.getMarginDigest(trader.accountId, marketId);

        assertBn.equal(marginUsd, wei(collateralDepositAmount).mul(collateralPrice).toBN());
      });

      it('should return zero marginUsd when no collateral has been deposited', async () => {
        const { BfpMarketProxy } = systems();
        const { trader, marketId } = await genTrader(bs);
        const { marginUsd } = await BfpMarketProxy.getMarginDigest(trader.accountId, marketId);

        assertBn.isZero(marginUsd);
      });

      it('should return marginUsd + pnl of position', async () => {
        const { BfpMarketProxy } = systems();
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
        const settleEvent = findEventSafe(receipt, 'OrderSettled', BfpMarketProxy);
        const keeperFee = settleEvent?.args.keeperFee as BigNumber;
        const { marginUsd: marginUsdBeforePriceChange } = await BfpMarketProxy.getMarginDigest(
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
        const { accruedFunding, accruedUtilization } = await BfpMarketProxy.getPositionDigest(
          trader.accountId,
          marketId
        );
        const newPnl = calcPricePnl(order.sizeDelta, newPrice, order.fillPrice);

        const { marginUsd: marginUsdAfterPriceChange } = await BfpMarketProxy.getMarginDigest(
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
        const { BfpMarketProxy } = systems();
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

        const { marginUsd: marginUsdBeforePriceChange } = await BfpMarketProxy.getMarginDigest(
          trader.accountId,
          marketId
        );
        assertBn.gt(marginUsdBeforePriceChange, 0);

        // Price double, causing our short to be underwater
        const newPrice = wei(order.oraclePrice).mul(2).toBN();

        // Update price
        await market.aggregator().mockSetCurrentPrice(newPrice);

        // Load margin again
        const { marginUsd: marginUsdAfterPriceChange } = await BfpMarketProxy.getMarginDigest(
          trader.accountId,
          marketId
        );
        // Assert marginUSD is 0 since price change made the position underwater
        assertBn.isZero(marginUsdAfterPriceChange);
      });

      it('should not consider a position in a different market for the same account', async () => {
        const { BfpMarketProxy } = systems();

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

        const { marginUsd: marginBeforeTradeOnDiffMarket } = await BfpMarketProxy.getMarginDigest(
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
        const { marginUsd: marginAfterTradeOnDiffMarket } = await BfpMarketProxy.getMarginDigest(
          trader.accountId,
          marketId
        );

        // Margin should stay unchanged.
        assertBn.equal(marginBeforeTradeOnDiffMarket, marginAfterTradeOnDiffMarket);
      });

      it('should reflect collateral price changes (non-usd)', async () => {
        const { BfpMarketProxy } = systems();

        const collateral = genOneOf(collateralsWithoutSusd());
        const { trader, marketId, collateralDepositAmount, collateralPrice } = await depositMargin(
          bs,
          genTrader(bs, { desiredCollateral: collateral })
        );

        await setMarketConfiguration(bs, {
          maxCollateralDiscount: bn(0),
          minCollateralDiscount: bn(0),
        });

        const { marginUsd: marginUsdBeforePriceChange } = await BfpMarketProxy.getMarginDigest(
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

        const { marginUsd: marginUsdAfterPriceChange } = await BfpMarketProxy.getMarginDigest(
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
      const { BfpMarketProxy } = systems();
      const { trader, marketId, collateral, market, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 1.1,
      });

      await commitAndSettle(bs, marketId, trader, order);

      const { marginUsd } = await BfpMarketProxy.getMarginDigest(trader.accountId, marketId);
      const netAssetValue = await BfpMarketProxy.getNetAssetValue(
        trader.accountId,
        marketId,
        order.oraclePrice
      );

      assertBn.equal(netAssetValue, marginUsd);
    });

    it('should use default oracle price if no price was specified', async () => {
      const { BfpMarketProxy } = systems();
      const { trader, marketId, collateral, market, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 1.1,
      });

      await commitAndSettle(bs, marketId, trader, order);

      const { marginUsd } = await BfpMarketProxy.getMarginDigest(trader.accountId, marketId);
      const netAssetValue = await BfpMarketProxy.getNetAssetValue(trader.accountId, marketId, 0);

      assertBn.equal(netAssetValue, marginUsd);
    });
  });

  describe('getWithdrawableMargin', () => {
    it('should revert when accountId does not exist', async () => {
      const { BfpMarketProxy } = systems();

      const { marketId } = await depositMargin(bs, genTrader(bs));
      const invalidAccountId = 42069;

      await assertRevert(
        BfpMarketProxy.getWithdrawableMargin(invalidAccountId, marketId),
        `AccountNotFound("${invalidAccountId}")`,
        BfpMarketProxy
      );
    });

    it('should revert when marketId does not exist', async () => {
      const { BfpMarketProxy } = systems();

      const { trader } = await depositMargin(bs, genTrader(bs));
      const invalidMarketId = 42069;

      await assertRevert(
        BfpMarketProxy.getWithdrawableMargin(trader.accountId, invalidMarketId),
        `MarketNotFound("${invalidMarketId}")`,
        BfpMarketProxy
      );
    });

    it('should return zero when no collateral deposits', async () => {
      const { BfpMarketProxy } = systems();

      const { trader } = await genTrader(bs);
      const { marketId } = genOneOf(markets());

      const margin = await BfpMarketProxy.getWithdrawableMargin(trader.accountId, marketId());
      assertBn.isZero(margin);
    });

    it('should return the full collateralUsd value when no position open', async () => {
      const { BfpMarketProxy } = systems();

      const desiredMarginUsdDepositAmount = genOneOf([5000, 10_000, 20_000]);
      const { trader, marketId } = await depositMargin(
        bs,
        genTrader(bs, { desiredMarginUsdDepositAmount })
      );

      const liqMarginRewardUsd = await BfpMarketProxy.getMarginLiquidationOnlyReward(
        trader.accountId,
        marketId
      );
      const expectedWithdrawableMargin = bn(desiredMarginUsdDepositAmount).sub(liqMarginRewardUsd);
      const margin = await BfpMarketProxy.getWithdrawableMargin(trader.accountId, marketId);

      assertBn.near(margin, expectedWithdrawableMargin, bn(0.000001));
    });

    it('should return the full collateralUsd value minus debt when no position open (concrete)', async () => {
      const { BfpMarketProxy } = systems();

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

      const { collateralUsd, debtUsd } = await BfpMarketProxy.getAccountDigest(
        trader.accountId,
        marketId
      );

      // There is _some_ debt on the account.
      assertBn.gt(debtUsd, bn(0));

      const margin = await BfpMarketProxy.getWithdrawableMargin(trader.accountId, marketId);
      const liqMarginRewardUsd = await BfpMarketProxy.getMarginLiquidationOnlyReward(
        trader.accountId,
        marketId
      );
      const expectedMargin = collateralUsd.sub(liqMarginRewardUsd).sub(debtUsd);

      assertBn.equal(margin, expectedMargin);
    });

    it('should return 0 when debt is bigger than collateral', async () => {
      const { BfpMarketProxy } = systems();

      const { trader, marketId, collateralPrice, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs)
      );
      await BfpMarketProxy.__test_addDebtUsdToAccountMargin(
        trader.accountId,
        marketId,
        wei(collateralDepositAmount).mul(collateralPrice).mul(1.1).toBN()
      );
      const margin = await BfpMarketProxy.getWithdrawableMargin(trader.accountId, marketId);
      assertBn.isZero(margin);
    });

    it('should return the discounted marginUsd less IM when position open', async () => {
      const { BfpMarketProxy } = systems();

      await setMarketConfiguration(bs, {
        minKeeperFeeUsd: bn(0),
        maxKeeperFeeUsd: bn(0),
      });

      const { trader, marketId, collateral, market, collateralDepositAmount } = await depositMargin(
        bs,
        genTrader(bs, {
          desiredMarginUsdDepositAmount: 10_000,
          desiredCollateral: genOneOf(collateralsWithoutSusd()), // Use non sUSD so margin is discounted.
        })
      );

      const order = await genOrder(bs, market, collateral, collateralDepositAmount, {
        desiredLeverage: 1,
        desiredSide: 1,
      });
      await commitAndSettle(bs, marketId, trader, order);

      const withdrawableMargin = await BfpMarketProxy.getWithdrawableMargin(
        trader.accountId,
        marketId
      );
      const { discountedMarginUsd } = await BfpMarketProxy.getMarginDigest(
        trader.accountId,
        marketId
      );
      const { im } = await BfpMarketProxy.getLiquidationMarginUsd(trader.accountId, marketId, 0);
      const expectedWithdrawableMargin = wei(discountedMarginUsd).sub(im);

      assertBn.equal(withdrawableMargin, expectedWithdrawableMargin.toBN());
    });
  });

  describe('getMarginCollateralConfiguration', () => {
    it('should return empty when there are no configured collaterals', async () => {
      const { BfpMarketProxy } = systems();

      const from = owner();
      await BfpMarketProxy.connect(from).setMarginCollateralConfiguration([], [], [], [], []);

      const collaterals = await BfpMarketProxy.getMarginCollateralConfiguration();
      assert.equal(collaterals.length, 0);
    });
  });

  describe('getDiscountedCollateralPrice', () => {
    forEach([bn(0), bn(genNumber(1, 10_000))]).it(
      'should return 1 when sUSD is the oracle price regardless of amount (%s)',
      async (amount: BigNumber) => {
        const { BfpMarketProxy } = systems();

        const sUsdCollateral = getSusdCollateral(collaterals());
        const collateralPrice = await BfpMarketProxy.getDiscountedCollateralPrice(
          sUsdCollateral.address(),
          amount
        );
        assertBn.equal(collateralPrice, bn(1));
      }
    );

    it('should not apply a discount on collateral price when spot market skew is 0', async () => {
      const { BfpMarketProxy } = systems();

      const collateral = genOneOf(collateralsWithoutSusd());

      // Set skewScale to 0.
      await BfpMarketProxy.setMarginCollateralConfiguration(
        [collateral.address()],
        [collateral.oracleNodeId()],
        [collateral.max],
        [bn(0)], // skew scale = 0.
        [collateral.rewardDistributorAddress()]
      );
      const collateralPrice = await collateral.getPrice();
      const priceWithDiscount = await BfpMarketProxy.getDiscountedCollateralPrice(
        collateral.address(),
        bn(0)
      );

      assertBn.equal(collateralPrice, priceWithDiscount);
    });

    it('should return oracle price when amount and minCollateralDiscount is 0', async () => {
      const { BfpMarketProxy } = systems();

      await setMarketConfiguration(bs, { minCollateralDiscount: bn(0) });

      const collateral = genOneOf(collateralsWithoutSusd());

      const collateralPrice = await collateral.getPrice();
      const priceWithDiscount = await BfpMarketProxy.getDiscountedCollateralPrice(
        collateral.address(),
        bn(0)
      );

      assertBn.equal(collateralPrice, priceWithDiscount);
    });

    it('should max bound the collateral discount on large skew shift', async () => {
      const { BfpMarketProxy } = systems();

      const collateral = genOneOf(collateralsWithoutSusd());
      const collateralPrice = await collateral.getPrice();

      const maxCollateralDiscount = bn(0.02);
      await setMarketConfiguration(bs, {
        minCollateralDiscount: bn(0.01),
        maxCollateralDiscount,
        collateralDiscountScalar: bn(0.5),
      });

      await withExplicitEvmMine(
        () =>
          BfpMarketProxy.setMarginCollateralConfiguration(
            [collateral.address()],
            [collateral.oracleNodeId()],
            [collateral.max],
            [bn(500_000)], // skewScale
            [collateral.rewardDistributorAddress()]
          ),
        provider()
      );

      // price = oraclePrice * (1 - min(max((amount * collateralDiscountScalar) / skewScale), minCollateralDiscount), maxCollateralDiscount))
      //
      // (30k * 0.5) / 500k * 2 = 0.03 (bounded by max is 0.02).
      const amount = bn(30_000);

      const expectedPrice = wei(collateralPrice).mul(bn(1).sub(maxCollateralDiscount)).toBN();
      const priceWithDiscount = await BfpMarketProxy.getDiscountedCollateralPrice(
        collateral.address(),
        amount
      );

      assertBn.equal(priceWithDiscount, expectedPrice);
    });

    it('should min bound the collateral discount on small skew shift', async () => {
      const { BfpMarketProxy } = systems();

      const collateral = genOneOf(collateralsWithoutSusd());
      const collateralPrice = await collateral.getPrice();

      const minCollateralDiscount = bn(0.01);
      await setMarketConfiguration(bs, {
        minCollateralDiscount,
        maxCollateralDiscount: bn(0.2),
        collateralDiscountScalar: bn(0.5),
      });
      await withExplicitEvmMine(
        () =>
          BfpMarketProxy.setMarginCollateralConfiguration(
            [collateral.address()],
            [collateral.oracleNodeId()],
            [collateral.max],
            [bn(500_000)], // skewScale
            [collateral.rewardDistributorAddress()]
          ),
        provider()
      );

      // price = oraclePrice * (1 - min(max((amount * collateralDiscountScalar) / skewScale), minCollateralDiscount), maxCollateralDiscount))
      //
      // (500 * 0.5) / 500k * 2 = 0.0005 (bounded by min is 0.01).
      const amount = bn(500);

      const expectedPrice = wei(collateralPrice).mul(bn(1).sub(minCollateralDiscount)).toBN();
      const priceWithDiscount = await BfpMarketProxy.getDiscountedCollateralPrice(
        collateral.address(),
        amount
      );

      assertBn.equal(priceWithDiscount, expectedPrice);
    });

    it('should match the expected discounted collateral price', async () => {
      const { BfpMarketProxy, USD } = systems();

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
      const skewScale = bn(500_000);
      await withExplicitEvmMine(
        () =>
          BfpMarketProxy.setMarginCollateralConfiguration(
            [collateral.address()],
            [collateral.oracleNodeId()],
            [collateral.max],
            [skewScale],
            [collateral.rewardDistributorAddress()]
          ),
        provider()
      );

      const amount = bn(genNumber(3000, 5000));

      const expectedPrice =
        collateral.address() === USD.address
          ? bn(1)
          : calcDiscountedCollateralPrice(
              collateralPrice,
              amount,
              skewScale,
              collateralDiscountScalar,
              minCollateralDiscount,
              maxCollateralDiscount
            );
      const actualPrice = await BfpMarketProxy.getDiscountedCollateralPrice(
        collateral.address(),
        amount
      );

      assertBn.equal(actualPrice, expectedPrice);
    });
  });
});
