import { BigNumber, ethers } from 'ethers';
import { bn, bootstrapMarkets, createKeeperCostNode, STRICT_PRICE_TOLERANCE } from '../bootstrap';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { createOracleNode } from '@synthetixio/oracle-manager/test/common';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';

describe('Create Market: operation and configuration', () => {
  const name = 'Ether',
    token = 'snxETH',
    price = bn(1000);

  const { systems, signers, owner, provider, trader1 } = bootstrapMarkets({
    synthMarkets: [],
    perpsMarkets: [], // don't create a market in bootstrap
    traderAccountIds: [2, 3],
    skipKeeperCostOracleNode: true,
  });

  let randomAccount: ethers.Signer;

  const restore = snapshotCheckpoint(provider);
  before(restore);

  before('identify actors', async () => {
    [, , , , randomAccount] = signers();
  });

  const marketId = BigNumber.from(25);
  let oracleNodeId: string;
  let keeperCostNodeId: string;

  before('create perps market', async () => {
    await systems().PerpsMarket.connect(owner()).createMarket(marketId, name, token);
  });

  before('set max market value', async () => {
    await systems().PerpsMarket.connect(owner()).setMaxMarketSize(marketId, bn(99999999));
    await systems().PerpsMarket.connect(owner()).setMaxMarketValue(marketId, bn(999999999999));
  });

  before('create price node', async () => {
    const results = await createOracleNode(owner(), price, systems().OracleManager);
    oracleNodeId = results.oracleNodeId;
  });

  before('create keeper reward node', async () => {
    const results = await createKeeperCostNode(owner(), systems().OracleManager);
    keeperCostNodeId = results.keeperCostNodeId;
  });

  describe('attempt to update price data with non-owner', () => {
    it('reverts', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(randomAccount)
          .updatePriceData(marketId, oracleNodeId, STRICT_PRICE_TOLERANCE),
        'Unauthorized'
      );
    });
  });

  describe('attempt to update keeper cost with non-owner', () => {
    it('reverts', async () => {
      await assertRevert(
        systems().PerpsMarket.connect(randomAccount).updateKeeperCostNodeId(keeperCostNodeId),
        'Unauthorized'
      );
    });
  });

  describe('before setting up price data', () => {
    it('reverts when trying to use the market', async () => {
      await assertRevert(
        systems()
          .PerpsMarket.connect(owner())
          .commitOrder({
            marketId: marketId,
            accountId: 2,
            sizeDelta: bn(1),
            settlementStrategyId: 0,
            acceptablePrice: bn(1050), // 5% slippage
            referrer: ethers.constants.AddressZero,
            trackingCode: ethers.constants.HashZero,
          }),
        'PriceFeedNotSet'
      );
    });
  });

  describe('when price data is updated', () => {
    before('update price data', async () => {
      await systems()
        .PerpsMarket.connect(owner())
        .updatePriceData(marketId, oracleNodeId, STRICT_PRICE_TOLERANCE);
    });

    describe('before setting up price data', () => {
      it('reverts when trying to use the market', async () => {
        await assertRevert(
          systems()
            .PerpsMarket.connect(owner())
            .commitOrder({
              marketId: marketId,
              accountId: 2,
              sizeDelta: bn(1),
              settlementStrategyId: 0,
              acceptablePrice: bn(1050), // 5% slippage
              referrer: ethers.constants.AddressZero,
              trackingCode: ethers.constants.HashZero,
            }),
          'KeeperCostsNotSet'
        );
      });
    });

    describe('when keeper cost data is updated', () => {
      before('update keeper reward data', async () => {
        await systems().PerpsMarket.connect(owner()).updateKeeperCostNodeId(keeperCostNodeId);
      });

      before('create settlement strategy', async () => {
        await systems()
          .PerpsMarket.connect(owner())
          .addSettlementStrategy(marketId, {
            strategyType: 0,
            settlementDelay: 5,
            settlementWindowDuration: 120,
            commitmentPriceDelay: 0,
            priceVerificationContract: ethers.constants.AddressZero,
            feedId: ethers.constants.HashZero,
            disabled: false,
            settlementReward: bn(5),
          });
      });

      before('set skew scale', async () => {
        await systems()
          .PerpsMarket.connect(owner())
          .setFundingParameters(marketId, bn(100_000), bn(0));
      });

      before('ensure per account max is set to zero', async () => {
        await systems().PerpsMarket.connect(owner()).setPerAccountCaps(0, 0);
      });

      it('reverts when trying add collateral if max collaterals per account is zero', async () => {
        await assertRevert(
          systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(10_000)),
          'MaxCollateralsPerAccountReached("0")'
        );
      });

      describe('when max collaterals per account is set to non-zero', () => {
        before('set max collaterals per account', async () => {
          await systems().PerpsMarket.connect(owner()).setPerAccountCaps(0, 1000);
        });

        before('add collateral', async () => {
          await systems().PerpsMarket.connect(trader1()).modifyCollateral(2, 0, bn(10_000));
        });

        it('reverts when trying to add position if max positions per account is zero', async () => {
          await assertRevert(
            systems()
              .PerpsMarket.connect(trader1())
              .commitOrder({
                marketId: marketId,
                accountId: 2,
                sizeDelta: bn(1),
                settlementStrategyId: 0,
                acceptablePrice: bn(1050), // 5% slippage
                referrer: ethers.constants.AddressZero,

                trackingCode: ethers.constants.HashZero,
              }),
            'MaxPositionsPerAccountReached("0")'
          );
        });

        describe('when max positions per account is set to non-zero', () => {
          before('set max positions per account', async () => {
            await systems().PerpsMarket.connect(owner()).setPerAccountCaps(1000, 1000);
          });
          it('should be able to use the market', async () => {
            await systems()
              .PerpsMarket.connect(trader1())
              .commitOrder({
                marketId: marketId,
                accountId: 2,
                sizeDelta: bn(1),
                settlementStrategyId: 0,
                acceptablePrice: bn(1050), // 5% slippage
                referrer: ethers.constants.AddressZero,
                trackingCode: ethers.constants.HashZero,
              });
          });
        });
      });
    });
  });
});
