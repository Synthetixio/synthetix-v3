import { BigNumber, ethers } from 'ethers';
import { bn, bootstrapMarkets } from '../bootstrap';
import assert from 'assert';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { createOracleNode } from '@synthetixio/oracle-manager/test/common';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';

describe('Create Market test', () => {
  const name = 'Ether',
    token = 'snxETH',
    price = bn(1000);

  const { systems, signers, owner, provider, superMarketId } = bootstrapMarkets({
    synthMarkets: [],
    perpsMarkets: [], // don't create a market in bootstrap
    traderAccountIds: [2, 3],
    skipKeeperCostOracleNode: true,
  });

  let randomAccount: ethers.Signer;

  const restore = snapshotCheckpoint(provider);

  before('identify actors', async () => {
    [, , , , randomAccount] = signers();
  });

  describe('market initialization', () => {
    before(restore);

    const marketId = BigNumber.from(25);
    let tx: ethers.providers.TransactionResponse;

    describe('when the market is created', () => {
      before('create perps market', async () => {
        tx = await systems().PerpsMarket.createMarket(marketId, name, token);
      });

      it('emits event', async () => {
        await assertEvent(
          tx,
          `MarketCreated(${marketId}, "${name}", "${token}")`,
          systems().PerpsMarket
        );
      });

      it('should return proper metadata', async () => {
        const metadata = await systems().PerpsMarket.metadata(marketId);
        assert.equal(metadata.name, name);
        assert.equal(metadata.symbol, token);
      });

      it('reverts attempting to create the same market again', async () => {
        await assertRevert(
          systems().PerpsMarket.createMarket(marketId, name, token),
          `InvalidMarket("${marketId.toString()}")`
        );
      });
    });

    describe('after market is created', () => {
      it('should emit MaxMarketSizeSet event', async () => {
        tx = await systems().PerpsMarket.connect(owner()).setMaxMarketSize(marketId, bn(99999999));
        await assertEvent(
          tx,
          `MaxMarketSizeSet(${marketId}, ${bn(99999999).toString()})`,
          systems().PerpsMarket
        );
      });

      it('should emit MaxMarketValueSet event', async () => {
        tx = await systems()
          .PerpsMarket.connect(owner())
          .setMaxMarketValue(marketId, bn(999999999999));
        await assertEvent(
          tx,
          `MaxMarketValueSet(${marketId}, ${bn(999999999999).toString()})`,
          systems().PerpsMarket
        );
      });
    });
  });

  describe('market initialization with invalid parameters', () => {
    before(restore);
    const marketId = BigNumber.from(25);

    before('create perps market', async () => {
      await systems().PerpsMarket.connect(owner()).createMarket(marketId, name, token);
    });

    describe('attempt to add a settlement strategy with 0 secs window duration', () => {
      it('reverts', async () => {
        await assertRevert(
          systems()
            .PerpsMarket.connect(owner())
            .addSettlementStrategy(marketId, {
              strategyType: 0,
              settlementDelay: 5,
              settlementWindowDuration: 0,
              commitmentPriceDelay: 0,
              priceVerificationContract: ethers.constants.AddressZero,
              feedId: ethers.constants.HashZero,
              disabled: false,
              settlementReward: bn(5),
            }),
          'InvalidSettlementWindowDuration("0")'
        );
      });
    });
  });

  describe('market interface views', () => {
    before(restore);

    const marketId = BigNumber.from(25);

    before('create perps market', async () => {
      await systems().PerpsMarket.createMarket(marketId, name, token);
    });

    before('create price nodes', async () => {
      await createOracleNode(owner(), price, systems().OracleManager);
    });

    describe('can get market data', () => {
      it('can get market reported debt', async () => {
        assertBn.equal(await systems().PerpsMarket.reportedDebt(marketId), bn(0));
      });

      it('can get market minimum credit', async () => {
        assertBn.equal(await systems().PerpsMarket.minimumCredit(marketId), bn(0));
      });
    });
  });

  describe('factory setup', () => {
    before(restore);

    describe('attempt to do it with non-owner', () => {
      it('reverts setting market name', async () => {
        await assertRevert(
          systems().PerpsMarket.connect(randomAccount).setPerpsMarketName('NewSuperMarket'),
          'Unauthorized'
        );
      });
    });

    describe('from owner', () => {
      before('set a new market name', async () => {
        await systems().PerpsMarket.connect(owner()).setPerpsMarketName('NewSuperMarket');
      });
      it('market name was updated', async () => {
        assert.equal(
          await systems().PerpsMarket.name(superMarketId()),
          'NewSuperMarket Perps Market'
        );
      });
    });
  });
});
