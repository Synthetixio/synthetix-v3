import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import { bn, bootstrapMarkets } from '../bootstrap';

describe('ModifyCollateral', () => {
  const accountIds = [10, 20];
  const invalidAccountId = 42069;
  const oneBTC = bn(1);

  const { systems, owner, synthMarkets, perpsMarkets, trader1, trader2 } = bootstrapMarkets({
    synthMarkets: [
      {
        name: 'Bitcoin',
        token: 'snxBTC',
        buyPrice: bn(10_000),
        sellPrice: bn(10_000),
      },
      {
        name: 'Ether',
        token: 'snxETH',
        buyPrice: bn(1_000),
        sellPrice: bn(1_000),
      },
    ],
    perpsMarkets: [
      { name: 'Bitcoin', token: 'snxBTC', price: bn(10_000) },
      { name: 'Ether', token: 'snxETH', price: bn(1_000) },
    ],
    traderAccountIds: accountIds,
  });

  const PERPS_MODIFY_COLLATERAL_PERMISSION_NAME =
    ethers.utils.formatBytes32String('PERPS_MODIFY_COLLATERAL');

  let synthBTCMarketId: ethers.BigNumber, synthETHMarketId: ethers.BigNumber;
  let perpBTCMarketId: ethers.BigNumber, perpETHMarketId: ethers.BigNumber;

  before('identify actors', () => {
    perpBTCMarketId = perpsMarkets()[0].marketId(); // 1
    perpETHMarketId = perpsMarkets()[1].marketId(); // 2
    synthBTCMarketId = synthMarkets()[0].marketId(); // 3
    synthETHMarketId = synthMarkets()[1].marketId(); // 4
  });

  describe('failure cases', async () => {
    it('reverts when the account does not exist', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(trader2())
          .modifyCollateral(invalidAccountId, perpBTCMarketId, oneBTC),
        `AccountNotFound("${invalidAccountId}"`
      );
    });

    it('reverts when the msg sender does not have valid permission', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(owner())
          .modifyCollateral(accountIds[1], perpBTCMarketId, oneBTC),
        `PermissionDenied("${
          accountIds[1]
        }", "${PERPS_MODIFY_COLLATERAL_PERMISSION_NAME}", "${await owner().getAddress()}")`
      );
    });

    it('reverts when trying to modify collateral with a zero amount delta', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .modifyCollateral(accountIds[0], perpETHMarketId, bn(0)),
        `InvalidAmountDelta("${bn(0)}")`
      );
    });

    it('reverts when it exceeds the max collateral amount', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .modifyCollateral(accountIds[0], perpBTCMarketId, bn(2)),
        `MaxCollateralExceeded("1")`
      );
    });

    it('reverts if the trader does not have enough allowance', async () => {
      await systems().PerpsMarket.connect(owner()).setMaxCollateralAmount(synthETHMarketId, oneBTC);

      await assertRevert(
        systems()
          .PerpsMarket.connect(trader1())
          .modifyCollateral(accountIds[0], synthETHMarketId, oneBTC),
        `InsufficientAllowance("${oneBTC}", "0")`
      );
    });

    it('reverts if the trader does not have enough spot balance', async () => {
      await systems().PerpsMarket.connect(owner()).setMaxCollateralAmount(synthBTCMarketId, oneBTC);

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
