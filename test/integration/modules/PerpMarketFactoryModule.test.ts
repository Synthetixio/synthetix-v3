import assert from 'assert';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { fastForward, fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { wei } from '@synthetixio/wei';
import forEach from 'mocha-each';
import { bootstrap } from '../../bootstrap';
import {
  genAddress,
  genBootstrap,
  genBytes32,
  genOneOf,
  genOrder,
  genOrderFromSizeDelta,
  genTrader,
} from '../../generators';
import { ONE_DAY_IN_SEC, commitAndSettle, depositMargin, setMarketConfigurationById } from '../../helpers';
import { BigNumber } from 'ethers';

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

  describe.only('getMarketDigest', () => {
    describe('{currentFundingRate,fundingVelocity}', () => {
      it.only('should compute current funding rate relative to time (concrete)', async () => {
        // This test is pulled directly from a conrete example developed for PerpsV2.
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
          // skew = long, r = (t 1000, s 100)
          {
            sizeDelta: wei(1000).toBN(),
            account: trader1,
            fastForwardInSec: 1000,
            expectedFundingRate: BigNumber.from(0),
            expectedFundingVelocity: wei(0.0025).toBN(),
          },
          // skew = even more long, r = (t 30000, s 300)
          {
            sizeDelta: wei(2000).toBN(),
            account: trader2,
            fastForwardInSec: 29_000,
            expectedFundingRate: wei(0.0083912).toBN(),
            expectedFundingVelocity: wei(0.0075).toBN(),
          },
          // skew = balanced but funding rate sticks, r (t 50000, s 0)
          {
            sizeDelta: wei(-3000).toBN(),
            account: trader3,
            fastForwardInSec: 20_000,
            expectedFundingRate: wei(0.02575231),
            expectedFundingVelocity: BigNumber.from(0),
          },
          // See below for one final fundingRate observation without a trade (no change in rate).
        ];

        // Deposit margin into each trader's account before opening trades.
        const marginUsdDepositAmount = 1_500_000; // 1.5M USD margin.
        for (const { account } of trades) {
          await depositMargin(
            bs,
            genTrader(bs, {
              desiredTrader: account,
              desiredCollateral: collateral,
              desiredMarket: market,
              desiredMarginUsdDepositAmount: marginUsdDepositAmount,
            })
          );
        }

        for (const trade of trades) {
          const { sizeDelta, account, fastForwardInSec, expectedFundingRate, expectedFundingVelocity } = trade;

          // fastward time, commit/settle order, get market digest for comparison.
          console.log((await provider().getBlock('latest')).timestamp);
          // console.log('fastForwardInSec', fastForwardInSec);
          await fastForwardTo((await provider().getBlock('latest')).timestamp + fastForwardInSec - 12, provider());
          console.log((await provider().getBlock('latest')).timestamp);

          const order = await genOrderFromSizeDelta(bs, market, sizeDelta, { desiredKeeperFeeBufferUsd: 0 });
          await commitAndSettle(bs, market.marketId(), account, order);

          const { fundingVelocity, currentFundingRate } = await PerpMarketProxy.getMarketDigest(market.marketId());
          console.log(currentFundingRate);

          assertBn.equal(fundingVelocity, expectedFundingVelocity);

          // const fundingRate = await perpsV2Market.currentFundingRate();
          // assert.bnClose(fundingRate, expectedRate, toUnit('0.001'));

          // const fundingSequenceLength = await perpsV2Market.fundingSequenceLength();
          // const funding = await perpsV2Market.fundingSequence(fundingSequenceLength - 1);
          // assert.bnClose(funding, expectedFunding, toUnit('0.001'));
        }

        // No change in skew, funding rate/velocity should remain the same.
        await fastForward(ONE_DAY_IN_SEC, provider()); // 1 day
        const { fundingVelocity, currentFundingRate } = await PerpMarketProxy.getMarketDigest(market.marketId());
        assertBn.equal(fundingVelocity, BigNumber.from(0));

        // assert.bnClose(fundingRate, trades[trades.length - 1].expectedRate, toUnit('0.001'));
      });

      it('should demonstrate a balance market can have a non-zero funding');

      it('should have zero funding when market is new and empty', async () => {
        const { PerpMarketProxy } = systems();

        // Use static market and traders for concrete example.
        const market = genOneOf(markets());

        // Expect zero values.
        const d1 = await PerpMarketProxy.getMarketDigest(market.marketId());
        assertBn.isZero(d1.size);
        assertBn.isZero(d1.currentFundingRate);
        assertBn.isZero(d1.fundingVelocity);

        await fastForward(60 * 60 * 24, provider());

        // Should still be zero values with no market changes.
        const d2 = await PerpMarketProxy.getMarketDigest(market.marketId());
        assertBn.isZero(d2.size);
        assertBn.isZero(d2.currentFundingRate);
        assertBn.isZero(d2.fundingVelocity);
      });

      it('should continue to increase funding in same direction so long as market is skewed');

      it('should stop increasing funding when market perfectly balanced');

      it('should change funding direction when skew flips');

      it('should cap velocity by maxFundingVelocity');

      forEach(['long', 'short']).it(
        'should result in max funding velocity when skew is %s 100%%',
        async (side: string) => {}
      );
    });
  });
});
