import { ethers as Ethers } from 'ethers';
import { bn, bootstrapTraders, bootstrapWithSynth } from './bootstrap';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assert from 'assert';
import assertBignumber from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import { SynthRouter } from '../generated/typechain';

describe('SpotMarketFactory', () => {
  const { systems, signers, marketId, aggregator } = bootstrapTraders(
    bootstrapWithSynth('Synthetic Ether', 'snxETH')
  ); // creates traders with USD

  let marketOwner: Ethers.Signer, user1: Ethers.Signer, user2: Ethers.Signer;
  let synth: SynthRouter;

  before('identify actors', async () => {
    [, , marketOwner, user1, user2] = signers();
  });

  before('identify synth', async () => {
    const synthAddress = await systems().SpotMarket.getSynth(marketId());
    synth = systems().Synth(synthAddress);
  });

  describe('spot market initilisation', () => {
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
          .nominateMarketOwner(1, await user2.getAddress()),
        'OnlyMarketOwner'
      );
    });

    it('nominateMarketOwner nominate a new owner for the pool', async () => {
      await systems()
        .SpotMarket.connect(marketOwner)
        .nominateMarketOwner(1, await user2.getAddress()),
        'OnlyMarketOwner';
    });

    it('only the nominated user can accept', async () => {
      await assertRevert(
        systems().SpotMarket.connect(user1).acceptMarketOwnership(1),
        'NotNominated'
      );
    });

    it('the nominated user can acceptMarketOwnership and become new market owner', async () => {
      await systems().SpotMarket.connect(user2).acceptMarketOwnership(1);
    });

    it('check ownership is transfered', async () => {
      assert.equal(await systems().SpotMarket.getMarketOwner(1), await user2.getAddress());
    });
  });

  describe('spot market reported debt', () => {
    it('check initial reported debt', async () => {
      assertBignumber.equal(await systems().SpotMarket.reportedDebt(marketId()), 0);
    });

    it('buy 2 snxETH', async () => {
      await systems().USD.connect(user1).approve(systems().SpotMarket.address, bn(2000));
      await systems().SpotMarket.connect(user1).buy(marketId(), bn(2000), bn(2));
    });

    it('market reported debt should be 1800 = 2 * 900 (with 18decimals)', async () => {
      assertBignumber.equal(await systems().SpotMarket.reportedDebt(marketId()), bn(1800));
    });

    it('sell 1 snxETH', async () => {
      await synth.connect(user1).approve(systems().SpotMarket.address, bn(1));
      await systems().SpotMarket.connect(user1).sell(marketId(), bn(1), bn(900));
    });

    it('market reported debt should be 900 = 1 * 900 (with 18decimals)', async () => {
      assertBignumber.equal(await systems().SpotMarket.reportedDebt(marketId()), bn(900));
    });

    it('move synth price', async () => {
      await aggregator().mockSetCurrentPrice(bn(500));
    });

    it('market reported debt should be 500 = 1 * 500 (with 18decimals)', async () => {
      assertBignumber.equal(await systems().SpotMarket.reportedDebt(marketId()), bn(500));
    });
  });
});
