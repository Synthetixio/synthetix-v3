import assert from 'assert';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { fastForward } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { wei } from '@synthetixio/wei';
import forEach from 'mocha-each';
import { bootstrap } from '../../bootstrap';
import {
  genAddress,
  genBootstrap,
  genBytes32,
  genNumber,
  genOneOf,
  genOrderFromSizeDelta,
  genTrader,
} from '../../generators';
import {
  SECONDS_ONE_DAY,
  SECONDS_ONE_HR,
  commitAndSettle,
  depositMargin,
  fastForwardBySec,
  setMarketConfigurationById,
} from '../../helpers';
import { BigNumber } from 'ethers';
import { Collateral, Market, Trader } from '../../typed';
import { isSameSide } from '../../calculations';

describe('PerpMarketFactoryModule', () => {
  const bs = bootstrap(genBootstrap());
  const { traders, owner, markets, collaterals, systems, provider, restore } = bs;

  beforeEach(restore);

  describe('setSynthetix', () => {
    it('should revert when invalid synthetix addr (due to needing USD token)', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();

      const address = genAddress();
      await assertRevert(
        PerpMarketProxy.connect(from).setSynthetix(address),
        'Error: transaction reverted in contract unknown'
      );
    });

    it('should revert when not owner', async () => {
      const { PerpMarketProxy } = systems();
      const from = traders()[0].signer;
      const address = genAddress();
      await assertRevert(
        PerpMarketProxy.connect(from).setSynthetix(address),
        `Unauthorized("${await from.getAddress()}")`
      );
    });
  });

  describe('setSpotMarket', () => {
    it('should set successfully', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();

      const address = genAddress();
      await PerpMarketProxy.connect(from).setSpotMarket(address);
      const config = await PerpMarketProxy.getMarketConfiguration();

      assert(config.spotMarket, address);
    });

    it('should revert when not owner', async () => {
      const { PerpMarketProxy } = systems();
      const from = traders()[0].signer;
      const address = genAddress();
      await assertRevert(
        PerpMarketProxy.connect(from).setSpotMarket(address),
        `Unauthorized("${await from.getAddress()}")`
      );
    });
  });

  describe('setPyth', () => {
    it('should set successfully', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();

      const address = genAddress();
      await PerpMarketProxy.connect(from).setPyth(address);
      const config = await PerpMarketProxy.getMarketConfiguration();

      assert(config.pyth, address);
    });

    it('should revert when not owner', async () => {
      const { PerpMarketProxy } = systems();
      const from = traders()[0].signer;
      const address = genAddress();
      await assertRevert(PerpMarketProxy.connect(from).setPyth(address), `Unauthorized("${await from.getAddress()}")`);
    });
  });

  describe('setEthOracleNodeId', () => {
    it('should set successfully', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();

      const nodeId = genBytes32();
      await PerpMarketProxy.connect(from).setEthOracleNodeId(nodeId);
      const config = await PerpMarketProxy.getMarketConfiguration();

      assert(config.ethOracleNodeId, nodeId);
    });

    it('should revert when not owner', async () => {
      const { PerpMarketProxy } = systems();
      const from = traders()[0].signer;
      const nodeId = genBytes32();
      await assertRevert(
        PerpMarketProxy.connect(from).setEthOracleNodeId(nodeId),
        `Unauthorized("${await from.getAddress()}")`
      );
    });
  });

  describe('getMarketDigest', () => {
    describe('{fundingRate,fundingVelocity}', () => {
      const depostMarginToTraders = async (
        traders: Trader[],
        market: Market,
        collateral: Collateral,
        marginUsdDepositAmount: number
      ) => {
        for (const trader of traders) {
          await depositMargin(
            bs,
            genTrader(bs, {
              desiredTrader: trader,
              desiredCollateral: collateral,
              desiredMarket: market,
              desiredMarginUsdDepositAmount: marginUsdDepositAmount,
            })
          );
        }
      };

      it('should compute current funding rate relative to time (concrete)', async () => {
        // This test is pulled directly from a concrete example developed for PerpsV2.
        //
        // @see: https://github.com/davidvuong/perpsv2-funding/blob/master/main.ipynb
        // @see: https://github.com/Synthetixio/synthetix/blob/develop/test/contracts/PerpsV2Market.js#L3631
        const { PerpMarketProxy } = systems();

        // Use static market and traders for concrete example.
        const market = markets()[0];
        const collateral = collaterals()[0];
        const trader1 = traders()[0];
        const trader2 = traders()[1];
        const trader3 = traders()[2];

        // Configure funding and velocity specific parameters so we get deterministic results.
        await setMarketConfigurationById(bs, market.marketId(), {
          skewScale: wei(100_000).toBN(),
          maxFundingVelocity: wei(0.25).toBN(),
          maxMarketSize: wei(500_000).toBN(),
        });

        // Set the market price as funding is denominated in USD.
        const marketOraclePrice = wei(100).toBN();
        await market.aggregator().mockSetCurrentPrice(marketOraclePrice);

        // A static list of traders and amount of time to pass by trader and its expected funding.
        const trades = [
          // skew = long, r = (t 1000, s 1000)
          {
            sizeDelta: wei(1000).toBN(),
            account: trader1,
            fastForwardInSec: 1000,
            expectedFundingRate: BigNumber.from(0),
            expectedFundingVelocity: wei(0.0025).toBN(),
          },
          // skew = even more long, r = (t 30000, s 3000)
          {
            sizeDelta: wei(2000).toBN(),
            account: trader2,
            fastForwardInSec: 29_000,
            expectedFundingRate: wei(0.00083912).toBN(),
            expectedFundingVelocity: wei(0.0075).toBN(),
          },
          // skew = balanced but funding rate sticks, r (t 50000, s 0)
          {
            sizeDelta: wei(-3000).toBN(),
            account: trader3,
            fastForwardInSec: 20_000,
            expectedFundingRate: wei(0.00257546).toBN(),
            expectedFundingVelocity: BigNumber.from(0),
          },
          // See below for one final fundingRate observation without a trade (no change in rate).
        ];

        // Deposit margin into each trader's account before opening trades.
        await depostMarginToTraders(
          trades.map(({ account }) => account),
          market,
          collateral,
          1_500_000 // 1.5M USD margin
        );

        let lastFundingRate = BigNumber.from(0);
        const { minOrderAge } = await PerpMarketProxy.getMarketConfiguration();

        for (const trade of trades) {
          const { sizeDelta, account, fastForwardInSec, expectedFundingRate, expectedFundingVelocity } = trade;

          // Fastforward by static seconds, excluding the settlement required min (minOrderAge) and 2s (for the commitment block).
          await fastForwardBySec(provider(), fastForwardInSec - minOrderAge.toNumber() - 2);

          const order = await genOrderFromSizeDelta(bs, market, sizeDelta, { desiredKeeperFeeBufferUsd: 0 });
          await commitAndSettle(bs, market.marketId(), account, order);

          const { fundingVelocity, fundingRate } = await PerpMarketProxy.getMarketDigest(market.marketId());

          assertBn.near(fundingRate, expectedFundingRate, wei(0.000001).toBN());
          assertBn.equal(fundingVelocity, expectedFundingVelocity);

          lastFundingRate = fundingRate;
        }

        // No change in skew (zero) and velocity/funding should remain the same.
        await fastForward(SECONDS_ONE_DAY, provider()); // 1 day
        const { fundingVelocity, fundingRate } = await PerpMarketProxy.getMarketDigest(market.marketId());

        assertBn.equal(fundingRate, lastFundingRate);
        assertBn.equal(fundingVelocity, BigNumber.from(0));
      });

      it('should demonstrate a balance market can have a non-zero funding', async () => {
        const { PerpMarketProxy } = systems();

        const market = genOneOf(markets());
        const collateral = genOneOf(collaterals());
        const trader1 = traders()[0];
        const trader2 = traders()[1];

        // Deposit margin into each trader's account before opening trades.
        await depostMarginToTraders(
          [trader1, trader2],
          market,
          collateral,
          500_000 // 500k USD margin
        );

        // Open a position for trader1.
        const sizeDelta = wei(genOneOf([genNumber(1, 10), genNumber(-10, -1)])).toBN();

        const order1 = await genOrderFromSizeDelta(bs, market, sizeDelta, { desiredKeeperFeeBufferUsd: 0 });
        await commitAndSettle(bs, market.marketId(), trader1, order1);
        await fastForwardBySec(provider(), genNumber(15_000, 30_000));

        const d1 = await PerpMarketProxy.getMarketDigest(market.marketId());
        assert.notEqual(d1.fundingRate.toString(), '0');

        const order2 = await genOrderFromSizeDelta(bs, market, sizeDelta, { desiredKeeperFeeBufferUsd: 0 });
        await commitAndSettle(bs, market.marketId(), trader2, order2);
        await fastForwardBySec(provider(), genNumber(15_000, 30_000));

        const d2 = await PerpMarketProxy.getMarketDigest(market.marketId());
        assert.notEqual(d2.fundingRate.toString(), '0');
      });

      it('should have zero funding when market is new and empty', async () => {
        const { PerpMarketProxy } = systems();

        // Use static market and traders for concrete example.
        const market = genOneOf(markets());

        // Expect zero values.
        const d1 = await PerpMarketProxy.getMarketDigest(market.marketId());
        assertBn.isZero(d1.size);
        assertBn.isZero(d1.fundingRate);
        assertBn.isZero(d1.fundingVelocity);

        await fastForward(60 * 60 * 24, provider());

        // Should still be zero values with no market changes.
        const d2 = await PerpMarketProxy.getMarketDigest(market.marketId());
        assertBn.isZero(d2.size);
        assertBn.isZero(d2.fundingRate);
        assertBn.isZero(d2.fundingVelocity);
      });

      it('should change funding direction when skew flips', async () => {
        const { PerpMarketProxy } = systems();

        const market = genOneOf(markets());
        const collateral = genOneOf(collaterals());

        const marginUsdDepositAmount = 500_000; // 1M USD.
        const { trader } = await depositMargin(
          bs,
          genTrader(bs, {
            desiredCollateral: collateral,
            desiredMarket: market,
            desiredMarginUsdDepositAmount: marginUsdDepositAmount,
          })
        );

        // Go short.
        const order1 = await genOrderFromSizeDelta(bs, market, wei(genNumber(-10, -1)).toBN(), {
          desiredKeeperFeeBufferUsd: 0,
        });
        await commitAndSettle(bs, market.marketId(), trader, order1);
        await fastForwardBySec(provider(), SECONDS_ONE_DAY);
        const d1 = await PerpMarketProxy.getMarketDigest(market.marketId());
        assertBn.lt(d1.fundingRate, BigNumber.from(0));

        // Go long.
        const order2 = await genOrderFromSizeDelta(bs, market, wei(genNumber(11, 20)).toBN(), {
          desiredKeeperFeeBufferUsd: 0,
        });
        await commitAndSettle(bs, market.marketId(), trader, order2);
        await fastForwardBySec(provider(), SECONDS_ONE_DAY);
        const d2 = await PerpMarketProxy.getMarketDigest(market.marketId());

        // New funding rate should be trending towards zero or positive.
        assertBn.gt(d2.fundingRate, d1.fundingRate);
      });

      forEach(['long', 'short']).it('should result in max funding velocity when %s skewed', async (side: string) => {
        const { PerpMarketProxy } = systems();

        const market = genOneOf(markets());
        const collateral = genOneOf(collaterals());

        // Set the price of market oracle to be something relatively small to avoid hitting insufficient margin.
        await market.aggregator().mockSetCurrentPrice(wei(genNumber(50, 100)).toBN());

        const marginUsdDepositAmount = 500_000; // 500k USD.
        const { trader } = await depositMargin(
          bs,
          genTrader(bs, {
            desiredCollateral: collateral,
            desiredMarket: market,
            desiredMarginUsdDepositAmount: marginUsdDepositAmount,
          })
        );

        // Velocity is skew/skewScale * maxVelocity. So in order in order to get max velocity of 1 * max then
        // skew must be equal to skewScale. Here we force the size to equal skewScale to test that it's capped
        // at and above.
        const skewScale = wei(1000).toBN();
        await setMarketConfigurationById(bs, market.marketId(), { skewScale });
        const sizeSide = side === 'long' ? 1 : -1;
        const sizeDelta = skewScale.add(wei(genNumber(1, 10)).toBN()).mul(sizeSide);

        const order = await genOrderFromSizeDelta(bs, market, sizeDelta, {
          desiredKeeperFeeBufferUsd: 0,
          desiredPriceImpactPercentage: 1, // 100% above/below oraclePrice e.g. $1000 oracle -> $2000 or $0
        });
        await commitAndSettle(bs, market.marketId(), trader, order);

        const { maxFundingVelocity } = await PerpMarketProxy.getMarketConfigurationById(market.marketId());
        const { fundingVelocity } = await PerpMarketProxy.getMarketDigest(market.marketId());

        assertBn.equal(fundingVelocity.abs(), maxFundingVelocity);
      });

      forEach(['long', 'short']).it(
        'should continue to increase (%s) funding in same direction insofar as market is skewed',
        async (side: string) => {
          const { PerpMarketProxy } = systems();

          const market = genOneOf(markets());
          const collateral = genOneOf(collaterals());

          const marginUsdDepositAmount = 500_000; // 500k USD.
          const { trader } = await depositMargin(
            bs,
            genTrader(bs, {
              desiredCollateral: collateral,
              desiredMarket: market,
              desiredMarginUsdDepositAmount: marginUsdDepositAmount,
            })
          );

          const sizeSide = side === 'long' ? 1 : -1;
          const sizeDelta = wei(genNumber(1, 10)).mul(sizeSide).toBN();

          const order = await genOrderFromSizeDelta(bs, market, sizeDelta, {
            desiredKeeperFeeBufferUsd: 0,
          });
          await commitAndSettle(bs, market.marketId(), trader, order);

          await fastForwardBySec(provider(), SECONDS_ONE_HR);

          const d1 = await PerpMarketProxy.getMarketDigest(market.marketId());

          await fastForwardBySec(provider(), SECONDS_ONE_DAY);

          const d2 = await PerpMarketProxy.getMarketDigest(market.marketId());

          // Funding rate should be expanding from skew in the same direction.
          assert.ok(isSameSide(d1.fundingRate, d2.fundingRate));
        }
      );
    });
  });

  describe('reportedDebt', () => {
    it('should have a debt of zero when first initialized');

    it('should expect sum of remaining margin to eq market debt');

    it('should expect sum of remaining margin to eq debt after a long period of trading');

    it('should expect debt to be calculated correctly (concrete)');

    it('should incur debt when a profitable position exits and withdraws all');

    it('should incur debt when trader is paid funding to hold position');

    it('should incur credit when trader pays funding to hold position');

    it('should reflect debt/credit in real time while position is still open');

    it('should generate credit when a neg pnl position exists and withdraws all');

    it('should generate credit when an underwater position is liquidated');

    it('should generate credit when price does not move and only fees and paid in/out');

    it('should not consider deposited margin as debt');

    it('should incur no debt in a delta neutral market with high when price volatility');

    it('should incur small debt proportional to skew with high price volatility');
  });
});
