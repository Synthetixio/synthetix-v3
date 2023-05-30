import { ethers } from 'ethers';
import { bn, bootstrapMarkets } from '../bootstrap';
import assert from 'assert';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
// import { AggregatorV3Mock } from '@synthetixio/oracle-manager/typechain-types';
import { createOracleNode } from '@synthetixio/oracle-manager/test/common';

describe('Create Market test', () => {
  const name = 'Ether',
    token = 'snxETH',
    price = bn(1000);

  const { systems, signers, owner, restore, poolId } = bootstrapMarkets({
    synthMarkets: [],
    perpsMarkets: [], // don't create a market in bootstrap
    traderAccountIds: [2, 3],
  });

  let marketOwner: ethers.Signer,
    anotherOwner: ethers.Signer,
    randomAccount: ethers.Signer,
    marketId: ethers.BigNumber;

  before('identify actors', async () => {
    [, , marketOwner, anotherOwner, randomAccount] = signers();
  });

  describe('market initialization', async () => {
    before(restore);

    let marketId: ethers.BigNumber;
    let tx: ethers.providers.TransactionResponse;

    describe('with zero address for market owner', () => {
      it('reverts', async () => {
        await assertRevert(
          systems().PerpsMarket.createMarket(name, token, ethers.constants.AddressZero),
          'InvalidMarketOwner'
        );
      });
    });

    describe('when the market is created', () => {
      before('create perps market', async () => {
        marketId = await systems().PerpsMarket.callStatic.createMarket(
          name,
          token,
          marketOwner.getAddress()
        );
        tx = await systems().PerpsMarket.createMarket(name, token, marketOwner.getAddress());
      });

      it('emits event', async () => {
        await assertEvent(
          tx,
          `MarketRegistered(${marketId}, "${await marketOwner.getAddress()}", "${name}", "${token}")`,
          systems().PerpsMarket
        );
      });

      it('should be able to get market name', async () => {
        assert.equal(await systems().PerpsMarket.name(marketId), name + ' Perps Market');
      });

      it('should be able to get market symbol', async () => {
        assert.equal(await systems().PerpsMarket.symbol(marketId), token);
      });

      it('should be able to get market owner', async () => {
        assert.equal(
          await systems().PerpsMarket.getMarketOwner(marketId),
          await marketOwner.getAddress()
        );
      });
    });
  });

  describe('change ownership', async () => {
    before(restore);

    let tx: ethers.providers.TransactionResponse;

    before('create perps market', async () => {
      marketId = await systems().PerpsMarket.callStatic.createMarket(
        name,
        token,
        marketOwner.getAddress()
      );
      await systems().PerpsMarket.createMarket(name, token, marketOwner.getAddress());
    });

    describe('some account other than owner', () => {
      it('reverts attempt to change ownership', async () => {
        await assertRevert(
          systems()
            .PerpsMarket.connect(randomAccount)
            .nominateMarketOwner(marketId, anotherOwner.getAddress()),
          'Unauthorized'
        );
      });

      it('reverts attempt to accept ownership', async () => {
        await assertRevert(
          systems().PerpsMarket.connect(randomAccount).acceptMarketOwnership(marketId),
          'NotNominated'
        );
      });
    });

    describe('owner nominates address zero', () => {
      it('reverts', async () => {
        await assertRevert(
          systems()
            .PerpsMarket.connect(marketOwner)
            .nominateMarketOwner(marketId, ethers.constants.AddressZero),
          'ZeroAddress'
        );
      });
    });

    describe('owner nominates', () => {
      before('nominate', async () => {
        tx = await systems()
          .PerpsMarket.connect(marketOwner)
          .nominateMarketOwner(marketId, anotherOwner.getAddress());
      });

      it('emits event', async () => {
        await assertEvent(
          tx,
          `MarketOwnerNominated(${marketId}, "${await anotherOwner.getAddress()}")`,
          systems().PerpsMarket
        );
      });

      it('reverts if accepted by other address', async () => {
        await assertRevert(
          systems().PerpsMarket.connect(randomAccount).acceptMarketOwnership(marketId),
          'NotNominated'
        );
      });

      describe('nominated address accepts', () => {
        before('accept', async () => {
          tx = await systems().PerpsMarket.connect(anotherOwner).acceptMarketOwnership(marketId);
        });

        it('emits event', async () => {
          await assertEvent(
            tx,
            `MarketOwnerChanged(${marketId}, "${await marketOwner.getAddress()}", "${await anotherOwner.getAddress()}")`,
            systems().PerpsMarket
          );
        });

        it('changed owner', async () => {
          assert.equal(
            await systems().PerpsMarket.getMarketOwner(marketId),
            await anotherOwner.getAddress()
          );
        });
      });
    });
  });

  describe('price data', async () => {
    before(restore);

    let oracleNodeId: string, marketId: ethers.BigNumber;

    before('create perps market', async () => {
      marketId = await systems().PerpsMarket.callStatic.createMarket(
        name,
        token,
        marketOwner.getAddress()
      );
      await systems().PerpsMarket.createMarket(name, token, marketOwner.getAddress());
    });

    before('create price nodes', async () => {
      const results = await createOracleNode(owner(), price, systems().OracleManager);
      oracleNodeId = results.oracleNodeId;
    });

    before('update price data', async () => {
      await systems().PerpsMarket.connect(marketOwner).updatePriceData(marketId, oracleNodeId);
    });

    before('delegate collateral from pool to market', async () => {
      await systems()
        .Core.connect(owner())
        .setPoolConfiguration(poolId, [
          {
            marketId,
            weightD18: ethers.utils.parseEther('1'),
            maxDebtShareValueD18: ethers.utils.parseEther('1'),
          },
        ]);
    });

    it('should check something TODO', async () => {});
  });

  describe('factory setup', async () => {
    before(restore);

    describe('attempt to do it with non-owner', () => {
      it('reverts setting synthetix', async () => {
        await assertRevert(
          systems().PerpsMarket.connect(randomAccount).setSynthetix(ethers.constants.AddressZero),
          'Unauthorized'
        );
      });

      it('reverts setting spot market', async () => {
        await assertRevert(
          systems().PerpsMarket.connect(randomAccount).setSpotMarket(ethers.constants.AddressZero),
          'Unauthorized'
        );
      });
    });

    describe('from owner', () => {
      it('can set synthetix', async () => {
        await systems().PerpsMarket.connect(owner()).setSynthetix(systems().Core.address);
      });

      it('can set spot market', async () => {
        await systems().PerpsMarket.connect(owner()).setSpotMarket(systems().SpotMarket.address);
      });
    });
  });

  describe('linked market data', async () => {
    before(restore);
  });
});
