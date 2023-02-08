import { ethers } from 'ethers';
import { bn, bootstrapTraders, bootstrapWithSynth } from './bootstrap';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { SynthRouter, AsyncOrderClaimRouter } from '../generated/typechain';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';

describe.only('AsyncOrderModule pyth', () => {
  const { systems, signers, marketId, provider, restore } = bootstrapTraders(
    bootstrapWithSynth('Synthetic Ether', 'snxETH')
  );

  let marketOwner: ethers.Signer,
    trader1: ethers.Signer,
    keeper: ethers.Signer,
    synth: SynthRouter,
    startTime: number,
    strategyId: number,
    pythSettlementStrategy: any,
    pythCallData: string,
    extraData: string;

  before('identify', async () => {
    [, , marketOwner, trader1, , keeper] = signers();
    const synthAddress = await systems().SpotMarket.getSynth(marketId());
    synth = systems().Synth(synthAddress);
  });

  before('add settlement strategy', async () => {
    pythSettlementStrategy = {
      strategyType: 2,
      settlementDelay: 5,
      settlementWindowDuration: 120,
      priceVerificationContract: systems().PythVerifierMock.address,
      feedId: ethers.utils.formatBytes32String('ETH/USD'),
      url: 'https://fakeapi.pyth.network/',
      settlementReward: bn(5),
      priceDeviationTolerance: bn(0.2),
    };

    strategyId = await systems()
      .SpotMarket.connect(marketOwner)
      .callStatic.addSettlementStrategy(marketId(), pythSettlementStrategy);
    await systems()
      .SpotMarket.connect(marketOwner)
      .addSettlementStrategy(marketId(), pythSettlementStrategy);
  });

  before('setup fixed fee', async () => {
    await systems().SpotMarket.connect(marketOwner).setAsyncFixedFee(marketId(), bn(0.01));
  });

  describe('commit order', () => {
    let commitTxn: ethers.providers.TransactionResponse;
    before('commit', async () => {
      startTime = await getTime(provider());
      await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(1000));
      commitTxn = await systems()
        .SpotMarket.connect(trader1)
        .commitOrder(marketId(), 2, bn(1000), 0, bn(0.8));
    });

    it('emits event', async () => {
      await assertEvent(
        commitTxn,
        `OrderCommitted(${marketId()}, 2, ${bn(1000)}, 1, "${await trader1.getAddress()}"`,
        systems().SpotMarket
      );
    });
  });

  describe('settle order', () => {
    before('fast forward to settlement time', async () => {
      await fastForwardTo(startTime + 6, provider());
      extraData = ethers.utils.defaultAbiCoder.encode(['uint128', 'uint128'], [marketId(), 1]);
      pythCallData = ethers.utils.solidityPack(
        ['bytes32', 'uint64'],
        [pythSettlementStrategy.feedId, startTime + 6]
      );
    });

    it('reverts with offchain error', async () => {
      const functionSig = systems().SpotMarket.interface.getSighash('settlePythOrder');
      // await assertRevert(
      //   systems().SpotMarket.connect(keeper).settleOrder(marketId(), 1),
      //   `OffchainLookup("${systems().SpotMarket.address}", "${
      //     pythSettlementStrategy.url
      //   }", "${pythCallData}", "${functionSig}", "${extraData}")`
      // );

      await assertRevert(
        systems().SpotMarket.connect(keeper).settleOrder(marketId(), 1),
        'OffchainLookup'
      );
    });
  });

  // after off chain look up
  describe('settle pyth order', () => {
    it('reverts due to high price deviation', async () => {
      await assertRevert(
        systems().SpotMarket.connect(keeper).settlePythOrder(pythCallData, extraData),
        'PriceDeviationToleranceExceeded'
      );
    });

    describe('change mock pyth price', () => {
      let settleTxn: ethers.providers.TransactionResponse;
      before('set mock pyth price', async () => {
        await systems().PythVerifierMock.setPrice('1100');
      });

      before('settle', async () => {
        settleTxn = await systems()
          .SpotMarket.connect(keeper)
          .settlePythOrder(pythCallData, extraData);
      });

      // ($1000 sent - $5 keeper) / ($1100/eth price) * 0.99 (1% fee) = 0.8955
      const expectedReturnAmt = bn('0.8955');

      it('sent correct amount to trader', async () => {
        assertBn.equal(await synth.balanceOf(await trader1.getAddress()), expectedReturnAmt);
      });

      it('emits settled event', async () => {
        await assertEvent(
          settleTxn,
          `OrderSettled(${marketId()}, 1, ${expectedReturnAmt}, ${bn(
            9.95
          )}, 0, "${await keeper.getAddress()}"`,
          systems().SpotMarket
        );
      });
    });
  });
});
