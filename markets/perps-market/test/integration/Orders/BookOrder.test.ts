import { ethers } from 'ethers';
import assert from 'assert/strict';
import { bn, bootstrapMarkets } from '../bootstrap';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { depositCollateral } from '../helpers';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { wei } from '@synthetixio/wei';

describe('Settle Orderbook order', () => {
  const orderFees = {
    makerFee: wei(0.0003), // 3bps
    takerFee: wei(0.0008), // 8bps
  };
  const { systems, owner, perpsMarkets, provider, trader1, trader2, keeper } = bootstrapMarkets({
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

  before('identify actors', async () => {
    ethMarketId = perpsMarkets()[0].marketId();
  });

  before('set Pyth Benchmark Price data', async () => {
    const offChainPrice = bn(1000);

    // set Pyth setBenchmarkPrice
    await systems().MockPythERC7412Wrapper.setBenchmarkPrice(offChainPrice);
  });

  before('deposit collateral', async () => {
    for (let i = 0; i < 38; i++) {
      await systems()
        .PerpsMarket.connect(i % 2 === 0 ? trader1() : trader2())
        ['createAccount(uint128)'](4 + i);
      await depositCollateral({
        systems,
        trader: i % 2 === 0 ? trader1 : trader2,
        accountId: () => 4 + i,
        collaterals: [
          {
            snxUSDAmount: () => bn(10_000),
          },
        ],
      });
      await systems()
        .PerpsMarket.connect(i % 2 === 0 ? trader1() : trader2())
        .setBookMode(4 + i, true);
    }
    await depositCollateral({
      systems,
      trader: trader1,
      accountId: () => 2,
      collaterals: [
        {
          snxUSDAmount: () => bn(10_000),
        },
      ],
    });

    await depositCollateral({
      systems,
      trader: trader2,
      accountId: () => 3,
      collaterals: [
        {
          snxUSDAmount: () => bn(10_000),
        },
      ],
    });

    await systems().PerpsMarket.connect(trader1()).setBookMode(2, true);
    await systems().PerpsMarket.connect(trader2()).setBookMode(3, true);
    await systems().PerpsMarket.connect(trader1()).setBookMode(4, true);
    await systems().PerpsMarket.connect(trader2()).setBookMode(5, true);
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

  it('has correct order mode', async () => {
    console.log(await systems().PerpsMarket.getOrderMode(3));
    assert(
      ethers.utils.parseBytes32String(
        (await systems().PerpsMarket.getOrderMode(3)) + '00000000000000000000000000000000'
      ) === 'RECENTLY_CHANGED'
    );
    assert(
      ethers.utils.parseBytes32String(
        (await systems().PerpsMarket.getOrderMode(5)) + '00000000000000000000000000000000'
      ) === ''
    );

    await fastForwardTo((await getTime(provider())) + 1000, provider());

    assert(
      ethers.utils.parseBytes32String(
        (await systems().PerpsMarket.getOrderMode(3)) + '00000000000000000000000000000000'
      ) === 'BOOK'
    );
    assert(
      ethers.utils.parseBytes32String(
        (await systems().PerpsMarket.getOrderMode(5)) + '00000000000000000000000000000000'
      ) === ''
    );
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
        const orders = [];
        for (let i = 0; i < 40; i++) {
          orders.push({
            accountId: i < 20 ? 2 : 2 + Math.floor(i),
            sizeDelta: bn(i % 2 === 0 ? (i % 5) + 2 : -((i % 5) + 2)),
            orderPrice: bn((i % 10) + 1100),
            signedPriceData: '0x',
            trackingCode: ethers.utils.formatBytes32String(''),
          });
        }
        tx = await systems().PerpsMarket.connect(keeper()).settleBookOrders(ethMarketId, orders);
        const waited = await tx.wait();
        console.log('tx gas', waited.gasUsed);
      });

      it.only('changes the account size again', async () => {
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
