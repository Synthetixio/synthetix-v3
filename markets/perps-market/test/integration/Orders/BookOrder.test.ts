import { ethers } from 'ethers';
import { DEFAULT_SETTLEMENT_STRATEGY, bn, bootstrapMarkets } from '../bootstrap';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { SynthMarkets } from '@synthetixio/spot-market/test/common';
import { DepositCollateralData, depositCollateral } from '../helpers';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { getTxTime } from '@synthetixio/core-utils/src/utils/hardhat/rpc';
import { calculateFillPrice, calculatePricePnl } from '../helpers/fillPrice';
import { wei } from '@synthetixio/wei';
import { calcCurrentFundingVelocity } from '../helpers/funding-calcs';
import { deepEqual } from 'assert/strict';

describe.only('Settle Orderbook order', () => {
  const orderFees = {
    makerFee: wei(0.0003), // 3bps
    takerFee: wei(0.0008), // 8bps
  };
  const { systems, owner, perpsMarkets, synthMarkets, provider, trader1, keeper } =
    bootstrapMarkets({
      synthMarkets: [
        {
          name: 'Bitcoin',
          token: 'snxBTC',
          buyPrice: bn(10_000),
          sellPrice: bn(10_000),
        },
      ],
      perpsMarkets: [
        {
          requestedMarketId: 25,
          name: 'Ether',
          token: 'snxETH',
          price: bn(1000),
          fundingParams: { skewScale: bn(100_000), maxFundingVelocity: bn(10) },
          orderFees: {
            makerFee: orderFees.makerFee.toBN(),
            takerFee: orderFees.takerFee.toBN(),
          },
        },
      ],
      traderAccountIds: [2, 3],
    });
  let ethMarketId: ethers.BigNumber;
  let ethSettlementStrategyId: ethers.BigNumber;
  let btcSynth: SynthMarkets[number];

  before('identify actors', async () => {
    ethMarketId = perpsMarkets()[0].marketId();
    ethSettlementStrategyId = perpsMarkets()[0].strategyId();
    btcSynth = synthMarkets()[0];
  });

  before('set Pyth Benchmark Price data', async () => {
    const offChainPrice = bn(1000);

    // set Pyth setBenchmarkPrice
    await systems().MockPythERC7412Wrapper.setBenchmarkPrice(offChainPrice);
  });

  before('deposit collateral', async () => {
    depositCollateral({
      systems,
      trader: trader1,
      accountId: () => 2,
      collaterals: [
        {
          snxUSDAmount: () => bn(10_000),
        },
      ],
    });

    depositCollateral({
      systems,
      trader: trader1,
      accountId: () => 3,
      collaterals: [
        {
          snxUSDAmount: () => bn(10_000),
        },
      ],
    });
  });

  before('set fee collector and referral', async () => {
    await systems().FeeCollectorMock.mockSetFeeRatio(bn(1));
    await systems()
      .PerpsMarket.connect(owner())
      .setFeeCollector(systems().FeeCollectorMock.address);
  });

  const restore = snapshotCheckpoint(provider);

  it.skip('fails if not called by orderbook', async () => {
    // for this test we consider `keeper` to be the orderbook
    // but it cna be a different address from the actual keeper
  });

  it('fails when the orders are not increasing account id order', async () => {
    await assertRevert(
      systems()
        .PerpsMarket.connect(keeper())
        .settleBookOrders(ethMarketId, [
          {
            accountId: 2,
            sizeDelta: bn(1),
            orderPrice: bn(1050),
            signedPriceData: '0x',
            trackingCode: ethers.utils.formatBytes32String(''),
          },
          {
            accountId: 3,
            sizeDelta: bn(3),
            orderPrice: bn(1100),
            signedPriceData: '0x',
            trackingCode: ethers.utils.formatBytes32String(''),
          },
          {
            accountId: 2,
            sizeDelta: bn(-5),
            orderPrice: bn(1300),
            signedPriceData: '0x',
            trackingCode: ethers.utils.formatBytes32String(''),
          },
        ]),
      'InvalidParameter("orders"',
      systems().PerpsMarket
    );
  });

  let tx: ethers.ContractTransaction;
  describe('1 order 1 account', async () => {
    before(restore);
    before('run orderbook order', async () => {
      tx = await systems()
        .PerpsMarket.connect(keeper())
        .settleBookOrders(ethMarketId, [
          {
            accountId: 2,
            sizeDelta: bn(1),
            orderPrice: bn(1050),
            signedPriceData: '0x',
            trackingCode: ethers.utils.formatBytes32String(''),
          },
        ]);
    });

    it('updates the account size', async () => {
      const [, , size] = await systems().PerpsMarket.getOpenPosition(2, ethMarketId);
      assertBn.equal(size, bn(1));
    });

    it('charges fees and deposits them to the RD', async () => {
      const balance = await systems().USD.balanceOf(systems().FeeCollectorMock.address);
      assertBn.equal(balance, bn(0.84));
    });

    it('charges the account with pnl (which is just fees right now)', async () => {
      const amount = await systems().PerpsMarket.getCollateralAmount(2, 0);
      assertBn.equal(amount, bn(9999.16));
      const debted = await systems().PerpsMarket.debt(2);
      assertBn.equal(debted, bn(0));
    });

    it('emits account events', async () => {
      await assertEvent(tx, 'BookOrderSettled', systems().PerpsMarket);
    });

    describe('run another order', () => {
      before('run another orderbook order', async () => {
        tx = await systems()
          .PerpsMarket.connect(keeper())
          .settleBookOrders(ethMarketId, [
            {
              accountId: 2,
              sizeDelta: bn(2),
              orderPrice: bn(1100),
              signedPriceData: '0x',
              trackingCode: ethers.utils.formatBytes32String(''),
            },
          ]);
      });

      it('changes the account size again', async () => {
        const [, , size] = await systems().PerpsMarket.getOpenPosition(2, ethMarketId);
        assertBn.equal(size, bn(3));
      });

      it('charges the account with pnl', async () => {
        const amount = await systems().PerpsMarket.getCollateralAmount(2, 0);
        // eth went up 50 dollars so we should have 50 more minus fees
        assertBn.equal(amount, bn(10047.4));
      });
    });
  });

  describe('3 orders 1 account', async () => {
    before(restore);
    before('run orderbook order', async () => {
      tx = await systems()
        .PerpsMarket.connect(keeper())
        .settleBookOrders(ethMarketId, [
          {
            accountId: 2,
            sizeDelta: bn(1),
            orderPrice: bn(1050),
            signedPriceData: '0x',
            trackingCode: ethers.utils.formatBytes32String(''),
          },
          {
            accountId: 2,
            sizeDelta: bn(3),
            orderPrice: bn(1100),
            signedPriceData: '0x',
            trackingCode: ethers.utils.formatBytes32String(''),
          },
          {
            accountId: 2,
            sizeDelta: bn(-5),
            orderPrice: bn(1300),
            signedPriceData: '0x',
            trackingCode: ethers.utils.formatBytes32String(''),
          },
        ]);

      it('updates the account size', async () => {
        const [, , size] = await systems().PerpsMarket.getOpenPosition(2, ethMarketId);
        assertBn.equal(size, bn(-1));
      });

      it('charges fees and deposits them to the RD', async () => {
        const balance = await systems().USD.balanceOf(systems().FeeCollectorMock.address);
        assertBn.equal(balance, bn(6.08));
      });

      it('emits account events', async () => {
        await assertEvent(tx, 'BookOrderSettled', systems().PerpsMarket);
      });
    });
  });

  describe('3 orders 2 accounts', async () => {
    before(restore);
    before('run orderbook order', async () => {
      tx = await systems()
        .PerpsMarket.connect(keeper())
        .settleBookOrders(ethMarketId, [
          {
            accountId: 2,
            sizeDelta: bn(1),
            orderPrice: bn(1050),
            signedPriceData: '0x',
            trackingCode: ethers.utils.formatBytes32String(''),
          },
          {
            accountId: 2,
            sizeDelta: bn(3),
            orderPrice: bn(1100),
            signedPriceData: '0x',
            trackingCode: ethers.utils.formatBytes32String(''),
          },
          {
            accountId: 3,
            sizeDelta: bn(-5),
            orderPrice: bn(1300),
            signedPriceData: '0x',
            trackingCode: ethers.utils.formatBytes32String(''),
          },
        ]);
    });

    it('updates the account size', async () => {
      const [, , size] = await systems().PerpsMarket.getOpenPosition(2, ethMarketId);
      assertBn.equal(size, bn(4));
    });

    it('charges fees and deposits them to the RD', async () => {
      const balance = await systems().USD.balanceOf(systems().FeeCollectorMock.address);
      assertBn.equal(balance, bn(6.08));
    });

    it('emits account events', async () => {
      await assertEvent(tx, 'BookOrderSettled', systems().PerpsMarket);
    });
  });
});
