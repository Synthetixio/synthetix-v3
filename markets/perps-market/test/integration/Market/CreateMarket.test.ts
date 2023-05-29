import { ethers } from 'ethers';
import { bn, bootstrapMarkets } from '../bootstrap';
// import { fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
// import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { AggregatorV3Mock } from '@synthetixio/oracle-manager/typechain-types';
import { createOracleNode } from '@synthetixio/oracle-manager/test/common';

import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
// import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';

describe('Create Market test', () => {
  const { systems, signers, owner, perpsMarkets, provider, trader1 } = bootstrapMarkets({
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
        `InvalidMarket("${marketId}")`
      );
    });
  });

  describe('when a market is added', async () => {
    const name = 'Ether',
      token = 'snxETH',
      price = bn(1000);
    let oracleNodeId: string, aggregator: AggregatorV3Mock, marketId: ethers.BigNumber;

    before('create price nodes', async () => {
      const results = await createOracleNode(owner(), price, systems().OracleManager);
      oracleNodeId = results.oracleNodeId;
      aggregator = results.aggregator;
    });

    before('create perps market', async () => {
      marketId = await systems().PerpsMarket.callStatic.createMarket(
        name,
        token,
        marketOwner.getAddress()
      );
      await systems().PerpsMarket.createMarket(name, token, marketOwner.getAddress());
      await systems().PerpsMarket.connect(marketOwner).updatePriceData(marketId, oracleNodeId);
    });

    describe('before updating price data', async () => {});

    describe('when price data is updated', async () => {
      before('update price data', async () => {
        await systems().PerpsMarket.connect(marketOwner).updatePriceData(marketId, oracleNodeId);
      });
    });

    // before('delegate collateral from pool to market', async () => {
    //   await systems().Core.connect(r.owner()).setPoolConfiguration(r.poolId, [
    //     {
    //       marketId,
    //       weightD18: ethers.utils.parseEther('1'),
    //       maxDebtShareValueD18: ethers.utils.parseEther('1'),
    //     },
    //   ]);
    // });

    before('add market', async () => {
      await systems().PerpsMarket.connect(marketOwner);
    });
  });

  // it('check position is live', async () => {
  //   const [pnl, funding, size] = await systems().PerpsMarket.openPosition(2, marketId);
  //   assertBn.equal(pnl, bn(-0.005));
  //   assertBn.equal(funding, bn(0));
  //   assertBn.equal(size, bn(1));
  // });
});
