import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import { bn, bootstrapMarkets } from '../bootstrap';

describe('ModifyCollateral', () => {
  const accountIds = [10, 20];
  const invalidAccountId = 42069;
  const oneBTC = bn(1);
  const btcPrice = bn(10_000);

  const { systems, owner, synthMarkets, trader1, trader2 } = bootstrapMarkets({
    synthMarkets: [
      {
        name: 'Bitcoin',
        token: 'snxBTC',
        buyPrice: btcPrice,
        sellPrice: btcPrice,
      },
      {
        name: 'Ether',
        token: 'snxETH',
        buyPrice: bn(1_000),
        sellPrice: bn(1_000),
      },
      {
        name: 'Link',
        token: 'snxLink',
        buyPrice: bn(5),
        sellPrice: bn(5),
      },
    ],
    perpsMarkets: [],
    traderAccountIds: accountIds,
  });

  const PERPS_MODIFY_COLLATERAL_PERMISSION_NAME =
    ethers.utils.formatBytes32String('PERPS_MODIFY_COLLATERAL');

  let synthBTCMarketId: ethers.BigNumber;
  let synthETHMarketId: ethers.BigNumber;
  let synthLINKMarketId: ethers.BigNumber;

  before('identify actors', () => {
    synthBTCMarketId = synthMarkets()[0].marketId();
    synthETHMarketId = synthMarkets()[1].marketId();
    synthLINKMarketId = synthMarkets()[2].marketId();
  });

  before('set setCollateralConfiguration to 1 btc', async () => {
    await systems()
      .PerpsMarket.connect(owner())
      .setCollateralConfiguration(synthBTCMarketId, bn(1), 0, 0, 0);
  });
  before('set setCollateralConfiguration to 0 link', async () => {
    await systems()
      .PerpsMarket.connect(owner())
      .setCollateralConfiguration(synthLINKMarketId, bn(0), 0, 0, 0);
  });
  before('trader1 buys 100 snxLink', async () => {
    const usdAmount = bn(100);
    const minAmountReceived = bn(20);
    const referrer = ethers.constants.AddressZero;
    await systems()
      .SpotMarket.connect(trader1())
      .buy(synthLINKMarketId, usdAmount, minAmountReceived, referrer);
  });

  describe('failure cases', () => {
    it('reverts when the account does not exist', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(trader2())
          .modifyCollateral(invalidAccountId, synthBTCMarketId, oneBTC),
        `AccountNotFound("${invalidAccountId}"`
      );
    });

    it('reverts when the msg sender does not have valid permission', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(owner())
          .modifyCollateral(accountIds[1], synthBTCMarketId, oneBTC),
        `PermissionDenied("${
          accountIds[1]
        }", "${PERPS_MODIFY_COLLATERAL_PERMISSION_NAME}", "${await owner().getAddress()}")`
      );
    });

    it('reverts when trying to modify collateral with a zero amount delta', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .modifyCollateral(accountIds[0], synthBTCMarketId, bn(0)),
        `InvalidAmountDelta("${bn(0)}")`
      );
    });

    it('reverts when trying to add synths not approved for collateral', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .modifyCollateral(accountIds[0], synthLINKMarketId, bn(50)),
        `SynthNotEnabledForCollateral("${synthLINKMarketId}")`
      );
    });

    it('reverts when trying to add non existent synth as collateral', async () => {
      const nonExistingSynthMarketId = bn(42069);
      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .modifyCollateral(accountIds[0], nonExistingSynthMarketId, bn(2)),
        `InvalidId("${nonExistingSynthMarketId}")`
      );
    });

    it('reverts when it exceeds the max collateral amount', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .modifyCollateral(accountIds[0], synthBTCMarketId, bn(2)),
        `MaxCollateralExceeded("${synthBTCMarketId}", "${bn(1)}", "${bn(0)}", "${bn(2)}")`
      );
    });

    it('reverts if the trader does not have enough allowance', async () => {
      await systems()
        .PerpsMarket.connect(owner())
        .setCollateralConfiguration(synthETHMarketId, oneBTC, 0, 0, 0);

      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .modifyCollateral(accountIds[0], synthETHMarketId, oneBTC),
        `InsufficientAllowance("${oneBTC}", "0")`
      );
    });

    it('reverts if the trader does not have enough spot balance', async () => {
      await systems()
        .PerpsMarket.connect(owner())
        .setCollateralConfiguration(synthBTCMarketId, oneBTC, 0, 0, 0);

      await synthMarkets()[0]
        .synth()
        .connect(trader1())
        .approve(systems().PerpsMarket.address, oneBTC);

      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .modifyCollateral(accountIds[0], synthBTCMarketId, oneBTC),
        `InsufficientBalance("${oneBTC}", "0")`
      );
    });
  });
});
