import { bn } from '@synthetixio/main/test/common';
import { bootstrapMarkets } from '../bootstrap';
import { BigNumber, Signer, utils } from 'ethers';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/src/utils/assertions/assert-revert';

describe.only('MarketConfiguration', async () => {
  const fixture = {
    token: 'snxETH',
    marketName: 'TestPerpsMarket',
    oderFees: { makerFee: 0, takerFee: 1 },
    settlementStrategies: {
      strategyType: 0,
      settlementDelay: 500,
      settlementWindowDuration: 100,
      priceVerificationContract: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      feedId: utils.formatBytes32String('feedId'),
      url: 'url',
      settlementReward: 100,
      priceDeviationTolerance: 200,
      disabled: false,
    },

    maxMarketValue: bn(10_000),
    maxFundingVelocity: bn(0.3),
    skewScale: bn(1),
    initialMarginFraction: bn(2),
    maintenanceMarginFraction: bn(10),
    lockedOiPercent: bn(15),
    maxLiquidationLimitAccumulationMultiplier: bn(5),
    liquidationRewardRatioD18: bn(10e9),
  };

  const { systems, signers } = bootstrapMarkets({
    synthMarkets: [],
    perpsMarkets: [],
    traderAccountIds: [],
  });

  let marketId: BigNumber;
  let randomUser: Signer;
  let marketOwner: Signer;

  before('identify actors', async () => {
    const [, owner, randomAccount] = await signers();
    randomUser = randomAccount;
    marketOwner = owner;
  });

  before('create perps market', async () => {
    marketId = await systems().PerpsMarket.callStatic.createMarket(
      fixture.marketName,
      fixture.token,
      marketOwner.getAddress()
    );
    await systems().PerpsMarket.createMarket(
      fixture.marketName,
      fixture.token,
      await marketOwner.getAddress()
    );
  });

  it('owner can set all market configurations properties', async () => {
    await systems()
      .PerpsMarket.connect(marketOwner)
      .addSettlementStrategy(marketId, fixture.settlementStrategies);
    await systems().PerpsMarket.connect(marketOwner).setSkewScale(marketId, fixture.skewScale);
    await systems().PerpsMarket.connect(marketOwner).setOrderFees(marketId, 0, fixture.oderFees);
    await systems()
      .PerpsMarket.connect(marketOwner)
      .setMaxMarketValue(marketId, fixture.maxMarketValue);
    await systems()
      .PerpsMarket.connect(marketOwner)
      .setMaxFundingVelocity(marketId, fixture.maxFundingVelocity);
    await systems()
      .PerpsMarket.connect(marketOwner)
      .setInitialMarginFraction(marketId, fixture.initialMarginFraction);
    await systems()
      .PerpsMarket.connect(marketOwner)
      .setMaintenanceMarginFraction(marketId, fixture.maintenanceMarginFraction);
    await systems()
      .PerpsMarket.connect(marketOwner)
      .setLockedOiPercent(marketId, fixture.lockedOiPercent);
    await systems()
      .PerpsMarket.connect(marketOwner)
      .setMaxLiquidationLimitAccumulationMultiplier(
        marketId,
        fixture.maxLiquidationLimitAccumulationMultiplier
      );
    await systems()
      .PerpsMarket.connect(marketOwner)
      .setLiquidationRewardRatioD18(marketId, fixture.liquidationRewardRatioD18);
  });

  it('should revert transaction when not market owner sets parameters', async () => {
    await assertRevert(
      systems().PerpsMarket.addSettlementStrategy(marketId, fixture.settlementStrategies),
      'OnlyMarketOwner("0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")'
    );
    await assertRevert(
      systems().PerpsMarket.setSkewScale(marketId, fixture.skewScale),
      'OnlyMarketOwner("0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")'
    );
    await assertRevert(
      systems().PerpsMarket.setOrderFees(marketId, 0, fixture.oderFees),
      'OnlyMarketOwner("0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")'
    );
    await assertRevert(
      systems().PerpsMarket.setMaxMarketValue(marketId, fixture.maxMarketValue),
      'OnlyMarketOwner("0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")'
    );
    await assertRevert(
      systems().PerpsMarket.setMaxFundingVelocity(marketId, fixture.maxFundingVelocity),
      'OnlyMarketOwner("0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")'
    );
    await assertRevert(
      systems().PerpsMarket.setInitialMarginFraction(marketId, fixture.initialMarginFraction),
      'OnlyMarketOwner("0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")'
    );
    await assertRevert(
      systems().PerpsMarket.setMaintenanceMarginFraction(
        marketId,
        fixture.maintenanceMarginFraction
      ),
      'OnlyMarketOwner("0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")'
    );
    await assertRevert(
      systems().PerpsMarket.setLockedOiPercent(marketId, fixture.lockedOiPercent),
      'OnlyMarketOwner("0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")'
    );
    await assertRevert(
      systems().PerpsMarket.setMaxLiquidationLimitAccumulationMultiplier(
        marketId,
        fixture.maxLiquidationLimitAccumulationMultiplier
      ),
      'OnlyMarketOwner("0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")'
    );
    await assertRevert(
      systems().PerpsMarket.setLiquidationRewardRatioD18(
        marketId,
        fixture.liquidationRewardRatioD18
      ),
      'OnlyMarketOwner("0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")'
    );
  });
});
