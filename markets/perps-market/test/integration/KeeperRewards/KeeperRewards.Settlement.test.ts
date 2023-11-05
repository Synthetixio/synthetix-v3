import { ethers } from 'ethers';
import { DEFAULT_SETTLEMENT_STRATEGY, bn, bootstrapMarkets } from '../bootstrap';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { depositCollateral } from '../helpers';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { getTxTime } from '@synthetixio/core-utils/src/utils/hardhat/rpc';
import { calculateFillPrice } from '../helpers/fillPrice';
import { wei } from '@synthetixio/wei';
import { calcCurrentFundingVelocity } from '../helpers/funding-calcs';

describe('Keeper Rewards - Settlement', () => {
  const KeeperCosts = {
    settlementCost: 1111,
    flagCost: 3333,
    liquidateCost: 5555,
  };
  const { systems, perpsMarkets, provider, trader1, keeperCostOracleNode, keeper, owner } =
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
        },
        {
          requestedMarketId: 30,
          name: 'Link',
          token: 'snxLINK',
          price: bn(5000),
          fundingParams: { skewScale: bn(200_000), maxFundingVelocity: bn(20) },
        },
      ],
      traderAccountIds: [2, 3],
    });
  let ethMarketId: ethers.BigNumber;

  before('identify actors', async () => {
    ethMarketId = perpsMarkets()[0].marketId();
  });

  const collateralsTestCase = [
    {
      name: 'only snxUSD',
      collateralData: {
        systems,
        trader: trader1,
        accountId: () => 2,
        collaterals: [
          {
            snxUSDAmount: () => bn(10_000),
          },
        ],
      },
    },
  ];

  let extraData: string, updateFee: ethers.BigNumber;

  let tx: ethers.ContractTransaction;
  let startTime: number;
  let pythPriceData: string;
  let settleTx: ethers.ContractTransaction;

  before('set keeper costs', async () => {
    await keeperCostOracleNode()
      .connect(owner())
      .setCosts(KeeperCosts.settlementCost, KeeperCosts.flagCost, KeeperCosts.liquidateCost);
  });

  before('add collateral', async () => {
    await depositCollateral(collateralsTestCase[0].collateralData);
  });

  before('commit the order', async () => {
    tx = await systems()
      .PerpsMarket.connect(trader1())
      .commitOrder({
        marketId: ethMarketId,
        accountId: 2,
        sizeDelta: bn(1),
        settlementStrategyId: 0,
        acceptablePrice: bn(1050), // 5% slippage
        referrer: ethers.constants.AddressZero,
        trackingCode: ethers.constants.HashZero,
      });
    startTime = await getTxTime(provider(), tx);
  });

  before('setup bytes data', () => {
    extraData = ethers.utils.defaultAbiCoder.encode(['uint128'], [2]);
    // pythCallData = ethers.utils.solidityPack(
    //   ['bytes32', 'uint64'],
    //   [DEFAULT_SETTLEMENT_STRATEGY.feedId, startTime + DEFAULT_SETTLEMENT_STRATEGY.settlementDelay]
    // );
  });

  before('fast forward to settlement time', async () => {
    // fast forward to settlement
    await fastForwardTo(startTime + DEFAULT_SETTLEMENT_STRATEGY.settlementDelay + 1, provider());
  });

  before('prepare data', async () => {
    // Get the latest price
    pythPriceData = await systems().MockPyth.createPriceFeedUpdateData(
      DEFAULT_SETTLEMENT_STRATEGY.feedId,
      1000_0000,
      1,
      -4,
      1000_0000,
      1,
      startTime + 6
    );
    updateFee = await systems().MockPyth['getUpdateFee(uint256)'](1);
  });

  let initialKeeperBalance: ethers.BigNumber;
  before('call liquidate', async () => {
    initialKeeperBalance = await systems().USD.balanceOf(await keeper().getAddress());
  });

  before('settle', async () => {
    settleTx = await systems()
      .PerpsMarket.connect(keeper())
      .settlePythOrder(pythPriceData, extraData, { value: updateFee });
  });

  it('keeper gets paid', async () => {
    const keeperBalance = await systems().USD.balanceOf(await keeper().getAddress());
    assertBn.equal(
      keeperBalance,
      initialKeeperBalance
        .add(DEFAULT_SETTLEMENT_STRATEGY.settlementReward)
        .add(KeeperCosts.settlementCost)
    );
  });

  it('emits settle event', async () => {
    const accountId = 2;
    const fillPrice = calculateFillPrice(wei(0), wei(100_000), wei(1), wei(1000)).toBN();
    const sizeDelta = bn(1);
    const newPositionSize = bn(1);
    const totalFees = DEFAULT_SETTLEMENT_STRATEGY.settlementReward.add(KeeperCosts.settlementCost);
    const settlementReward = DEFAULT_SETTLEMENT_STRATEGY.settlementReward.add(
      KeeperCosts.settlementCost
    );
    const trackingCode = `"${ethers.constants.HashZero}"`;
    const msgSender = `"${await keeper().getAddress()}"`;
    const params = [
      ethMarketId,
      accountId,
      fillPrice,
      0,
      0,
      sizeDelta,
      newPositionSize,
      totalFees,
      0, // referral fees
      0, // collected fees
      settlementReward,
      trackingCode,
      msgSender,
    ];
    await assertEvent(settleTx, `OrderSettled(${params.join(', ')})`, systems().PerpsMarket);
  });

  it('emits market updated event', async () => {
    const price = bn(1000);
    const marketSize = bn(1);
    const marketSkew = bn(1);
    const sizeDelta = bn(1);
    const currentFundingRate = bn(0);
    const currentFundingVelocity = calcCurrentFundingVelocity({
      skew: wei(1),
      skewScale: wei(100_000),
      maxFundingVelocity: wei(10),
    });
    const params = [
      ethMarketId,
      price,
      marketSkew,
      marketSize,
      sizeDelta,
      currentFundingRate,
      currentFundingVelocity.toBN(), // Funding rates should be tested more thoroughly elsewhre
    ];
    await assertEvent(settleTx, `MarketUpdated(${params.join(', ')})`, systems().PerpsMarket);
  });

  it('emits collateral deducted events', async () => {
    let pendingTotalFees = DEFAULT_SETTLEMENT_STRATEGY.settlementReward.add(
      KeeperCosts.settlementCost
    );
    const accountId = 2;

    const collateral = collateralsTestCase[0].collateralData.collaterals[0];
    const synthMarket = 0;
    let deductedCollateralAmount: ethers.BigNumber = bn(0);
    deductedCollateralAmount = collateral.snxUSDAmount().lt(pendingTotalFees)
      ? collateral.snxUSDAmount()
      : pendingTotalFees;
    pendingTotalFees = pendingTotalFees.sub(deductedCollateralAmount);

    await assertEvent(
      settleTx,
      `CollateralDeducted(${accountId}, ${synthMarket}, ${deductedCollateralAmount})`,
      systems().PerpsMarket
    );
  });

  it('check position is live', async () => {
    const [pnl, funding, size] = await systems().PerpsMarket.getOpenPosition(2, ethMarketId);
    assertBn.equal(pnl, bn(-0.005));
    assertBn.equal(funding, bn(0));
    assertBn.equal(size, bn(1));
  });
});
