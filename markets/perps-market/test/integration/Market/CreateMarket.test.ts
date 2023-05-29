import { ethers } from 'ethers';
import { bootstrapMarkets } from '../bootstrap';
// import { bn, bootstrapMarkets } from '../bootstrap';
// import { fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
// import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
// import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';

describe('Create Market test', () => {
  const { systems, signers, perpsMarkets, provider, trader1 } = bootstrapMarkets({
    synthMarkets: [],
    perpsMarkets: [], // don't create a market in bootstrap
    traderAccountIds: [2, 3],
  });

  let marketOwner: ethers.Signer, marketId: ethers.BigNumber;

  before('identify actors', async () => {
    [, , marketOwner] = signers();
  });

  // before('create settlement strategy', async () => {
  //   // await systems()
  //   //   .PerpsMarket.connect(marketOwner)
  //   //   .addSettlementStrategy(marketId, {
  //   //     strategyType: 0,
  //   //     settlementDelay: 5,
  //   //     settlementWindowDuration: 120,
  //   //     priceVerificationContract: ethers.constants.AddressZero,
  //   //     feedId: ethers.constants.HashZero,
  //   //     url: '',
  //   //     disabled: false,
  //   //     settlementReward: bn(5),
  //   //     priceDeviationTolerance: bn(0.01),
  //   //   });
  // });

  // before('set skew scale', async () => {
  //   await systems().PerpsMarket.connect(marketOwner).setSkewScale(marketId, bn(100_000));
  // });

  describe('before adding market', async () => {
    it('should not be able to open position', async () => {
      const marketId = 1;
      await assertRevert(
        systems().PerpsMarket.openPosition(2, marketId),
        `MarketNotFound("${marketId}")`
      );
    });
  });

  // it('check position is live', async () => {
  //   const [pnl, funding, size] = await systems().PerpsMarket.openPosition(2, marketId);
  //   assertBn.equal(pnl, bn(-0.005));
  //   assertBn.equal(funding, bn(0));
  //   assertBn.equal(size, bn(1));
  // });
});
