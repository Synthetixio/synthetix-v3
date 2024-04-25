import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import { assertAddressEqual } from '@synthetixio/core-utils/utils/assertions/assert-address';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { generateExternalNode } from '@synthetixio/oracle-manager/test/common';
import assert from 'assert';
import { constants, ethers } from 'ethers';
import { ISynthTokenModule__factory } from '../typechain-types/index';
import { bn, bootstrapTraders, bootstrapWithSynth } from './bootstrap';
import { SynthRouter } from './generated/typechain';

describe('SpotMarketFactory', () => {
  const { systems, signers, marketId, aggregator, restore } = bootstrapTraders(
    bootstrapWithSynth('Synthetic Ether', 'snxETH')
  ); // creates traders with USD

  let registerTxn: ethers.providers.TransactionResponse, synthMarketId: ethers.BigNumber;
  let marketOwner: ethers.Signer, user1: ethers.Signer, newMarketOwner: ethers.Signer;
  let synth: SynthRouter;

  before('identify actors', async () => {
    [, , marketOwner, user1, newMarketOwner] = signers();
  });

  before('identify synth', async () => {
    const synthAddress = await systems().SpotMarket.getSynth(marketId());
    synth = systems().Synth(synthAddress);
  });

  describe('spot market initialization', () => {
    const tokenName = 'Synthetic BTC';
    after(restore);

    describe('with zero address for synth owner', () => {
      it('reverts', async () => {
        await assertRevert(
          systems().SpotMarket.createSynth(tokenName, 'sBTC', ethers.constants.AddressZero),
          'InvalidMarketOwner'
        );
      });
    });

    it('renounce market ownership by non-owner', async () => {
      await assertRevert(
        systems().SpotMarket.connect(user1).renounceMarketOwnership(marketId()),
        'OnlyMarketOwner'
      );
    });

    it('non owner tries to renounce market ownership', async () => {
      await assertRevert(
        systems().SpotMarket.connect(user1).renounceMarketOwnership(marketId()),
        `OnlyMarketOwner("${await marketOwner.getAddress()}", "${await user1.getAddress()}")`
      );
    });

    it('renounce market ownership by owner', async () => {
      const tx = await systems()
        .SpotMarket.connect(marketOwner)
        .renounceMarketOwnership(marketId());
      await assertEvent(
        tx,
        `MarketOwnerChanged(${marketId()}, "${await marketOwner.getAddress()}", "${
          constants.AddressZero
        }")`,
        systems().SpotMarket
      );

      assert.deepEqual(
        await systems().SpotMarket.getMarketOwner(marketId()),
        constants.AddressZero
      );
    });

    before('register synth', async () => {
      synthMarketId = await systems().SpotMarket.callStatic.createSynth(
        tokenName,
        'sBTC',
        await marketOwner.getAddress()
      );
      registerTxn = await systems().SpotMarket.createSynth(
        tokenName,
        'sBTC',
        await marketOwner.getAddress()
      );
    });

    it('check market name', async () => {
      assert.equal(await systems().SpotMarket.name(2), tokenName + ' Spot Market');
    });

    it('emits event', async () => {
      await assertEvent(
        registerTxn,
        `SynthRegistered(2, "${await systems().SpotMarket.getSynth(synthMarketId)}")`,
        systems().SpotMarket
      );
    });
  });

  describe('price data', () => {
    let tx: ethers.providers.TransactionResponse | ethers.providers.TransactionReceipt;
    let nodeId100: ethers.utils.BytesLike, nodeId200: ethers.utils.BytesLike;
    const priceTolerance = 100;

    before('create dummy nodes', async () => {
      nodeId100 = await generateExternalNode(systems().OracleManager, 100, 10);
      nodeId200 = await generateExternalNode(systems().OracleManager, 200, 10);
    });

    before('set price data', async () => {
      tx = await systems()
        .SpotMarket.connect(marketOwner)
        .updatePriceData(marketId(), nodeId100, nodeId200, priceTolerance);
    });

    it('emits the right event', async () => {
      await assertEvent(
        tx,
        `SynthPriceDataUpdated(${marketId()}, "${nodeId100}", "${nodeId200}", ${priceTolerance})`,
        systems().SpotMarket
      );
    });

    it('can get current price data', async () => {
      const priceData = await systems().SpotMarket.connect(marketOwner).getPriceData(marketId());

      assert.equal(priceData[0], nodeId100);
      assert.equal(priceData[1], nodeId200);
      assert.equal(priceData[2], priceTolerance);
    });

    describe('index price', () => {
      it('reverts if you send wrong transaction type', async () => {
        await assertRevert(
          systems().SpotMarket.connect(marketOwner).indexPrice(marketId(), 12, 0),
          'InvalidTransactionType'
        );
      });

      it('returns price with valid args', async () => {
        const buyPrice = await systems()
          .SpotMarket.connect(marketOwner)
          .indexPrice(marketId(), 1, 0); // buy feed
        const sellPrice = await systems()
          .SpotMarket.connect(marketOwner)
          .indexPrice(marketId(), 2, 0); // buy feed

        assertBn.equal(buyPrice, 100);
        assertBn.equal(sellPrice, 200);
      });
    });

    after(restore);
  });

  describe('upgrade synth', () => {
    it('fails if no upgrade is available', async () => {
      await assertRevert(
        systems().SpotMarket.upgradeSynthImpl(marketId()),
        'NoChange()',
        systems().SpotMarket
      );
    });

    describe('when upgraded impl is set', () => {
      let tx: ethers.providers.TransactionResponse;

      before(async () => {
        // just set it to USD for testing purposes
        await systems().SpotMarket.setSynthImplementation(systems().USDRouter.address);
        tx = await systems().SpotMarket.upgradeSynthImpl(marketId());
      });

      it('has upgraded impl address', async () => {
        assertAddressEqual(
          await systems().SpotMarket.getSynthImpl(marketId()),
          systems().USDRouter.address
        );
      });

      it('emits event', async () => {
        await assertEvent(
          tx,
          `SynthImplementationUpgraded(${marketId()}, "${await systems().SpotMarket.getSynth(
            marketId()
          )}", "${systems().USDRouter.address}")`,
          systems().SpotMarket
        );
      });
    });
  });

  describe('set decay rate', () => {
    it('only works for market owner', async () => {
      await assertRevert(
        systems().SpotMarket.connect(user1).setDecayRate(marketId(), 1234),
        'OnlyMarketOwner'
      );
    });

    describe('success', () => {
      before(restore);

      before('set decay', async () => {
        await systems().SpotMarket.connect(marketOwner).setDecayRate(marketId(), 1234);
      });

      it('sets the decay rate on the underlying synth', async () => {
        const decayRate = await ISynthTokenModule__factory.connect(
          await systems().SpotMarket.getSynth(marketId()),
          user1
        ).callStatic.decayRate();

        assertBn.equal(decayRate, 1234);
      });
    });
  });

  describe('transferring market ownership', () => {
    it('nominateMarketOwner reverts if is not called by the market owner', async () => {
      await assertRevert(
        systems()
          .SpotMarket.connect(user1)
          .nominateMarketOwner(1, await newMarketOwner.getAddress()),
        'OnlyMarketOwner'
      );
    });

    it('nominateMarketOwner nominate a new owner for the market', async () => {
      await systems()
        .SpotMarket.connect(marketOwner)
        .nominateMarketOwner(1, await newMarketOwner.getAddress());
    });

    it('check nominated market owner address', async () => {
      assert.equal(
        await systems().SpotMarket.getNominatedMarketOwner(1),
        await newMarketOwner.getAddress()
      );
    });

    it('only the nominated user can accept', async () => {
      await assertRevert(
        systems().SpotMarket.connect(user1).acceptMarketOwnership(1),
        'NotNominated'
      );
    });

    it('the nominated user can acceptMarketOwnership and become new market owner', async () => {
      await systems().SpotMarket.connect(newMarketOwner).acceptMarketOwnership(1);
    });

    it('check ownership is transfered', async () => {
      assert.equal(await systems().SpotMarket.getMarketOwner(1), await newMarketOwner.getAddress());
    });
  });

  describe('spot market reported debt', () => {
    it('check initial reported debt', async () => {
      assertBn.equal(await systems().SpotMarket.reportedDebt(marketId()), 0);
    });

    it('buy 2 snxETH', async () => {
      await systems().USD.connect(user1).approve(systems().SpotMarket.address, bn(2000));
      await systems()
        .SpotMarket.connect(user1)
        .buy(marketId(), bn(2000), bn(2), ethers.constants.AddressZero);
    });

    it('market reported debt should be 1800 = 2 * 900 (with 18decimals)', async () => {
      assertBn.equal(await systems().SpotMarket.reportedDebt(marketId()), bn(1800));
    });

    it('sell 1 snxETH', async () => {
      await synth.connect(user1).approve(systems().SpotMarket.address, bn(1));
      await systems()
        .SpotMarket.connect(user1)
        .sell(marketId(), bn(1), bn(900), ethers.constants.AddressZero);
    });

    it('market reported debt should be 900 = 1 * 900 (with 18decimals)', async () => {
      assertBn.equal(await systems().SpotMarket.reportedDebt(marketId()), bn(900));
    });

    it('move synth price', async () => {
      await aggregator().mockSetCurrentPrice(bn(500));
    });

    it('market reported debt should be 500 = 1 * 500 (with 18decimals)', async () => {
      assertBn.equal(await systems().SpotMarket.reportedDebt(marketId()), bn(500));
    });
  });

  describe('locked', () => {
    before(restore);

    before('user1 buys 10 snxEth', async () => {
      await systems().USD.connect(user1).approve(systems().SpotMarket.address, bn(10000));
      await systems()
        .SpotMarket.connect(user1)
        .buy(marketId(), bn(10000), bn(10), ethers.constants.AddressZero);
    });

    describe('when collateral leverage is zero', () => {
      it('reverts', async () => {
        await assertRevert(
          systems().SpotMarket.connect(marketOwner).setCollateralLeverage(marketId(), bn(0)),
          'InvalidCollateralLeverage'
        );
      });
    });

    describe('when collateral leverage is 1', () => {
      before('set collateral leverage', async () => {
        await systems().SpotMarket.connect(marketOwner).setCollateralLeverage(marketId(), bn(1));
      });

      it('should return $10,000', async () => {
        assertBn.equal(await systems().SpotMarket.minimumCredit(marketId()), bn(10_000));
      });
    });

    describe('when collateral leverage is 2', () => {
      before('set collateral leverage', async () => {
        await systems().SpotMarket.connect(marketOwner).setCollateralLeverage(marketId(), bn(2));
      });

      it('should return $5,000', async () => {
        assertBn.equal(await systems().SpotMarket.minimumCredit(marketId()), bn(5_000));
      });
    });
  });
});
