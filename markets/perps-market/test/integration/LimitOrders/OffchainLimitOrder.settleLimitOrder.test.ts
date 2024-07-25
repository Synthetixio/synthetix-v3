import { ethers } from 'ethers';
import { bn, bootstrapMarkets } from '../bootstrap';
// import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { SynthMarkets } from '@synthetixio/spot-market/test/common';
import {
  DepositCollateralData,
  depositCollateral,
  createMatchingLimitOrders,
  signOrder,
  Order,
} from '../helpers';
import { wei } from '@synthetixio/wei';
// import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
// import assert from 'assert';
// import { getTxTime } from '@synthetixio/core-utils/src/utils/hardhat/rpc';

describe('Settle Offchain Limit Order tests', () => {
  const { systems, perpsMarkets, synthMarkets, provider, trader1, trader2, signers, owner } =
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
          fundingParams: { skewScale: bn(100_000), maxFundingVelocity: bn(0) },
        },
      ],
      traderAccountIds: [2, 3],
    });
  let ethMarketId: ethers.BigNumber;
  let btcSynth: SynthMarkets[number];
  let shortOrder: Order;
  let longOrder: Order;
  const price = bn(999.9995);
  const amount = bn(1);
  let relayer: ethers.Signer;
  const relayerRatio = wei(0.3); // 30%

  before('identify relayer', async () => {
    relayer = signers()[8];
  });

  // TODO set on a per market level
  before('set fee collector and referral', async () => {
    await systems()
      .PerpsMarket.connect(owner())
      .setFeeCollector(systems().FeeCollectorMock.address);
    await systems()
      .PerpsMarket.connect(owner())
      .updateRelayerShare(await relayer.getAddress(), relayerRatio.toBN()); // 30%
  });

  // let btcSynth: SynthMarkets[number];

  const PERPS_COMMIT_LIMIT_ORDER_PERMISSION_NAME = ethers.utils.formatBytes32String(
    'PERPS_COMMIT_LIMIT_ORDER'
  );

  before('identify actors', async () => {
    ethMarketId = perpsMarkets()[0].marketId();
    btcSynth = synthMarkets()[0];
  });

  const restoreToCommit = snapshotCheckpoint(provider);

  const testCase: Array<{ name: string; collateralData: DepositCollateralData[] }> = [
    {
      name: 'snxUSD and snxBTC',
      collateralData: [
        {
          systems,
          trader: trader1,
          accountId: () => 2,
          collaterals: [
            {
              snxUSDAmount: () => bn(10_000_000),
            },
            {
              synthMarket: () => btcSynth,
              snxUSDAmount: () => bn(10_000_000),
            },
          ],
        },
        {
          systems,
          trader: trader2,
          accountId: () => 3,
          collaterals: [
            {
              snxUSDAmount: () => bn(10_000_000),
            },
            {
              synthMarket: () => btcSynth,
              snxUSDAmount: () => bn(10_000_000),
            },
          ],
        },
      ],
    },
  ];

  // TODO set the maker and taker fees. Require those to be set in the code maybe?
  let tx: ethers.ContractTransaction;
  // let startTime: number;

  before(restoreToCommit);

  before('add collateral', async () => {
    await depositCollateral(testCase[0].collateralData[0]);
    await depositCollateral(testCase[0].collateralData[1]);
  });

  before('creates the orders', async () => {
    const orders = createMatchingLimitOrders({
      accountId: testCase[0].collateralData[1].accountId(),
      marketId: ethMarketId,
      relayer: ethers.utils.getAddress(await relayer.getAddress()),
      amount,
      isShort: false,
      trackingCode: ethers.constants.HashZero,
      price,
      expiration: Math.floor(Date.now() / 1000) + 1000,
      nonce: 9732849,
      isMaker: false,
    });
    shortOrder = orders.shortOrder;
    longOrder = orders.longOrder;
  });

  const restoreToSnapshot = snapshotCheckpoint(provider);

  it('settles the orders and emits the proper events', async () => {
    const signedShortOrder = await signOrder(
      shortOrder,
      trader1() as ethers.Wallet,
      systems().PerpsMarket.address
    );
    console.log('signer should be the account owner');
    console.log('short order signer', await trader1().getAddress());
    const signedLongOrder = await signOrder(
      longOrder,
      trader2() as ethers.Wallet,
      systems().PerpsMarket.address
    );
    console.log('long order signer', await trader2().getAddress());
    tx = await systems()
      .PerpsMarket.connect(owner())
      .settleLimitOrder(shortOrder, signedShortOrder, longOrder, signedLongOrder);
    const orderSettledEventsArgs = {
      trader1: [
        `${ethMarketId}`,
        `${shortOrder.accountId}`,
        `${price}`,
        `${0}`,
        `${0}`,
        `${shortOrder.amount}`,
        `${0}`,
        `${0}`,
        `${0}`,
        `${0}`,
        `"${shortOrder.trackingCode}"`,
        `${0}`,
      ].join(', '),
      trader2: [
        `${ethMarketId}`,
        `${longOrder.accountId}`,
        `${price}`,
        `${0}`,
        `${0}`,
        `${longOrder.amount}`,
        `${0}`,
        `${0}`,
        `${0}`,
        `${0}`,
        `"${longOrder.trackingCode.toString()}"`,
        `${0}`,
      ].join(', '),
    };
    // TODO fix this test
    const marketUpdateEventsArgs = {
      trader1: [
        `${ethMarketId}`,
        `${price}`,
        -1000000000000000000,
        1000000000000000000,
        `${shortOrder.amount}`,
        0,
        0,
        0,
      ].join(', '),
      trader2: [
        `${ethMarketId}`,
        `${price}`,
        0,
        2000000000000000000,
        `${longOrder.amount}`,
        0,
        0,
        0,
      ].join(', '),
    };
    await assertEvent(
      tx,
      `LimitOrderSettled(${orderSettledEventsArgs.trader1})`,
      systems().PerpsMarket
    );
    await assertEvent(
      tx,
      `LimitOrderSettled(${orderSettledEventsArgs.trader2})`,
      systems().PerpsMarket
    );
    await assertEvent(
      tx,
      `MarketUpdated(${marketUpdateEventsArgs.trader1})`,
      systems().PerpsMarket
    );
    await assertEvent(
      tx,
      `MarketUpdated(${marketUpdateEventsArgs.trader2})`,
      systems().PerpsMarket
    );
  });

  it('fails when the relayers are different for each order', async () => {
    const badLongOrder = { ...longOrder, relayer: await trader1().getAddress() };
    const signedShortOrder = await signOrder(
      shortOrder,
      trader1() as ethers.Wallet,
      systems().PerpsMarket.address
    );
    const badSignedLongOrder = await signOrder(
      badLongOrder,
      trader2() as ethers.Wallet,
      systems().PerpsMarket.address
    );
    await assertRevert(
      systems()
        .PerpsMarket.connect(owner())
        .settleLimitOrder(shortOrder, signedShortOrder, badLongOrder, badSignedLongOrder),
      `LimitOrderDifferentRelayer(${shortOrder.relayer}, ${badLongOrder.relayer})`
    );
  });

  it('fails when the markets are different for each order', async () => {
    const badLongOrder = { ...longOrder, marketId: ethers.BigNumber.from(133) };
    const signedShortOrder = await signOrder(
      shortOrder,
      trader1() as ethers.Wallet,
      systems().PerpsMarket.address
    );
    const badSignedLongOrder = await signOrder(
      badLongOrder,
      trader2() as ethers.Wallet,
      systems().PerpsMarket.address
    );
    await assertRevert(
      systems()
        .PerpsMarket.connect(owner())
        .settleLimitOrder(shortOrder, signedShortOrder, badLongOrder, badSignedLongOrder),
      `LimitOrderMarketMismatch(${shortOrder.marketId}, ${badLongOrder.marketId})`
    );
  });

  it('fails when the amounts are different for each order', async () => {
    const badLongOrder = { ...longOrder, amount: bn(10) };
    const signedShortOrder = await signOrder(
      shortOrder,
      trader1() as ethers.Wallet,
      systems().PerpsMarket.address
    );
    const badSignedLongOrder = await signOrder(
      badLongOrder,
      trader2() as ethers.Wallet,
      systems().PerpsMarket.address
    );
    await assertRevert(
      systems()
        .PerpsMarket.connect(owner())
        .settleLimitOrder(shortOrder, signedShortOrder, badLongOrder, badSignedLongOrder),
      `LimitOrderAmountError(${shortOrder.amount}, ${badLongOrder.amount})`
    );
  });

  it('fails with an invalid relayer', async () => {
    const badLongOrder = { ...longOrder, relayer: await trader1().getAddress() };
    const badShortOrder = { ...shortOrder, relayer: await trader1().getAddress() };
    const badSignedShortOrder = await signOrder(
      badShortOrder,
      trader1() as ethers.Wallet,
      systems().PerpsMarket.address
    );
    const badSignedLongOrder = await signOrder(
      badLongOrder,
      trader2() as ethers.Wallet,
      systems().PerpsMarket.address
    );
    await assertRevert(
      systems()
        .PerpsMarket.connect(owner())
        .settleLimitOrder(badShortOrder, badSignedShortOrder, badLongOrder, badSignedLongOrder),
      `LimitOrderRelayerInvalid(${badLongOrder.relayer})`
    );
  });

  it('fails when the signing account is not authorized for a permission', async () => {
    const badSignerAddress = await trader1().getAddress();
    const signedShortOrder = await signOrder(
      shortOrder,
      trader1() as ethers.Wallet,
      systems().PerpsMarket.address
    );
    const badSignedLongOrder = await signOrder(
      longOrder,
      // NOTE fails because this should be trader2
      trader1() as ethers.Wallet,
      systems().PerpsMarket.address
    );
    await assertRevert(
      systems()
        .PerpsMarket.connect(owner())
        .settleLimitOrder(shortOrder, signedShortOrder, longOrder, badSignedLongOrder),
      `PermissionDenied(${longOrder.accountId}, "${PERPS_COMMIT_LIMIT_ORDER_PERMISSION_NAME}", "${badSignerAddress}")`
    );
  });

  it('fails when either limit order has expired', async () => {
    const blockNumber = await provider().getBlockNumber();
    const block = await provider().getBlock(blockNumber);
    const expirationTimestamp = block.timestamp - 1000;

    const badLongOrder = { ...longOrder, expiration: expirationTimestamp };

    const signedShortOrder = await signOrder(
      shortOrder,
      trader1() as ethers.Wallet,
      systems().PerpsMarket.address
    );

    const badSignedLongOrder = await signOrder(
      badLongOrder,
      trader2() as ethers.Wallet,
      systems().PerpsMarket.address
    );

    const nextBlock = await provider().getBlock('latest');
    const nextBlockTimestamp = nextBlock.timestamp;

    // TODO fix this test - it only works if I add +1 for some reason
    await assertRevert(
      systems()
        .PerpsMarket.connect(owner())
        .settleLimitOrder(shortOrder, signedShortOrder, badLongOrder, badSignedLongOrder),
      `LimitOrderExpired(${shortOrder.accountId}, ${shortOrder.expiration}, ${longOrder.accountId}, ${badLongOrder.expiration}, ${nextBlockTimestamp + 1})`
    );

    const badShortOrder = { ...shortOrder, expiration: expirationTimestamp };

    const badSignedShortOrder = await signOrder(
      badShortOrder,
      trader1() as ethers.Wallet,
      systems().PerpsMarket.address
    );

    const signedLongOrder = await signOrder(
      longOrder,
      trader2() as ethers.Wallet,
      systems().PerpsMarket.address
    );

    const nextBlockTwo = await provider().getBlock('latest');
    const nextBlockTimestampTwo = nextBlockTwo.timestamp;

    // TODO fix this test - it only works if I add +1 for some reason
    await assertRevert(
      systems()
        .PerpsMarket.connect(owner())
        .settleLimitOrder(badShortOrder, badSignedShortOrder, longOrder, signedLongOrder),
      `LimitOrderExpired(${badShortOrder.accountId}, ${badShortOrder.expiration}, ${longOrder.accountId}, ${longOrder.expiration}, ${nextBlockTimestampTwo + 1})`
    );
  });
  after(restoreToSnapshot);
});
