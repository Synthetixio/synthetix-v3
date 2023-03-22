import { ethers as Ethers } from 'ethers';
import { bn, bootstrapTraders, bootstrapWithSynth } from './bootstrap';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assert from 'assert';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import { SynthRouter } from '../generated/typechain';

describe('SpotMarketFactory', () => {
  const { systems, signers, marketId, aggregator, restore } = bootstrapTraders(
    bootstrapWithSynth('Synthetic Ether', 'snxETH')
  ); // creates traders with USD

  let marketOwner: Ethers.Signer, user1: Ethers.Signer, newMarketOwner: Ethers.Signer;
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

    before('register synth', async () => {
      await systems().SpotMarket.callStatic.createSynth(
        tokenName,
        'sBTC',
        marketOwner.getAddress()
      );
      await systems().SpotMarket.createSynth(tokenName, 'sBTC', marketOwner.getAddress());
    });

    it('check market name', async () => {
      assert.equal(await systems().SpotMarket.name(2), tokenName + ' Spot Market');
    });
  });

  describe('transfering market ownership', () => {
    it('nominateMarketOwner reverts if is not called by the market owner', async () => {
      await assertRevert(
        systems()
          .SpotMarket.connect(user1)
          .nominateMarketOwner(1, await newMarketOwner.getAddress()),
        'OnlyMarketOwner'
      );
    });

    it('nominateMarketOwner nominate a new owner for the pool', async () => {
      await systems()
        .SpotMarket.connect(marketOwner)
        .nominateMarketOwner(1, await newMarketOwner.getAddress()),
        'OnlyMarketOwner';
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
        .buy(marketId(), bn(2000), bn(2), Ethers.constants.AddressZero);
    });

    it('market reported debt should be 1800 = 2 * 900 (with 18decimals)', async () => {
      assertBn.equal(await systems().SpotMarket.reportedDebt(marketId()), bn(1800));
    });

    it('sell 1 snxETH', async () => {
      await synth.connect(user1).approve(systems().SpotMarket.address, bn(1));
      await systems()
        .SpotMarket.connect(user1)
        .sell(marketId(), bn(1), bn(900), Ethers.constants.AddressZero);
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
        .buy(marketId(), bn(10000), bn(10), Ethers.constants.AddressZero);
    });

    describe('when collateral leverage is zero', () => {
      before('set collateral leverage', async () => {
        await systems().SpotMarket.connect(marketOwner).setCollateralLeverage(marketId(), bn(0));
      });

      it('should return zero', async () => {
        assertBn.equal(await systems().SpotMarket.locked(marketId()), 0);
      });
    });

    describe('when collateral leverage is 1', () => {
      before('set collateral leverage', async () => {
        await systems().SpotMarket.connect(marketOwner).setCollateralLeverage(marketId(), bn(1));
      });

      it('should return $10,000', async () => {
        assertBn.equal(await systems().SpotMarket.locked(marketId()), bn(10_000));
      });
    });

    describe('when collateral leverage is 2', () => {
      before('set collateral leverage', async () => {
        await systems().SpotMarket.connect(marketOwner).setCollateralLeverage(marketId(), bn(2));
      });

      it('should return $5,000', async () => {
        assertBn.equal(await systems().SpotMarket.locked(marketId()), bn(5_000));
      });
    });
  });
});
