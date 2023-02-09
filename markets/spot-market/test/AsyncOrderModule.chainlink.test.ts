import { ethers } from 'ethers';
import { bn, bootstrapTraders, bootstrapWithSynth } from './bootstrap';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { SynthRouter } from '../generated/typechain';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';

describe.only('AsyncOrderModule chainlink', () => {
  const { systems, signers, marketId, provider } = bootstrapTraders(
    bootstrapWithSynth('Synthetic Ether', 'snxETH')
  );

  let marketOwner: ethers.Signer,
    trader1: ethers.Signer,
    keeper: ethers.Signer,
    synth: SynthRouter,
    startTime: number,
    strategyId: number,
    chainlinkSettlementStrategy: Record<string, unknown>,
    chainlinkCallData: string,
    extraData: string;

  before('identify', async () => {
    [, , marketOwner, trader1, , keeper] = signers();
    const synthAddress = await systems().SpotMarket.getSynth(marketId());
    synth = systems().Synth(synthAddress);
  });

  before('add settlement strategy', async () => {
    chainlinkSettlementStrategy = {
      strategyType: 1,
      settlementDelay: 5,
      settlementWindowDuration: 120,
      priceVerificationContract: systems().OracleVerifierMock.address,
      feedId: ethers.utils.formatBytes32String('ETH-USD'),
      url: 'https://fakeapi.chainlink.network/',
      settlementReward: bn(5),
      priceDeviationTolerance: bn(0.2),
    };

    strategyId = await systems()
      .SpotMarket.connect(marketOwner)
      .callStatic.addSettlementStrategy(marketId(), chainlinkSettlementStrategy);
    await systems()
      .SpotMarket.connect(marketOwner)
      .addSettlementStrategy(marketId(), chainlinkSettlementStrategy);
  });

  before('setup fixed fee', async () => {
    await systems().SpotMarket.connect(marketOwner).setAsyncFixedFee(marketId(), bn(0.01));
  });

  describe('commit order', () => {
    let commitTxn: ethers.providers.TransactionResponse;
    before('commit', async () => {
      await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(1000));
      commitTxn = await systems()
        .SpotMarket.connect(trader1)
        .commitOrder(marketId(), 2, bn(1000), strategyId, bn(0.8));
      startTime = await getTime(provider());
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
    });

    before('setup bytes data', () => {
      extraData = ethers.utils.defaultAbiCoder.encode(['uint128', 'uint128'], [marketId(), 1]);
      chainlinkCallData = ethers.utils.solidityPack(
        ['bytes32', 'uint64'],
        [chainlinkSettlementStrategy.feedId, startTime + 5]
      );
    });

    it('reverts with offchain error', async () => {
      const functionSig = systems().SpotMarket.interface.getSighash('settleChainlinkOrder');

      await assertRevert(
        systems().SpotMarket.connect(keeper).settleOrder(marketId(), 1),
        `OffchainLookup("${systems().SpotMarket.address}", "${
          chainlinkSettlementStrategy.url
        }", "${chainlinkCallData}", "${functionSig}", "${extraData}")`
      );
    });
  });

  // after off chain look up
  describe('settle chainlink order', () => {
    it('reverts due to high price deviation', async () => {
      await assertRevert(
        systems().SpotMarket.connect(keeper).settleChainlinkOrder(chainlinkCallData, extraData),
        'PriceDeviationToleranceExceeded'
      );
    });

    describe('change mock chainlink price', () => {
      let settleTxn: ethers.providers.TransactionResponse;
      before('set mock chainlink price', async () => {
        await systems().OracleVerifierMock.setPrice('1100');
      });

      before('settle', async () => {
        settleTxn = await systems()
          .SpotMarket.connect(keeper)
          .settleChainlinkOrder(chainlinkCallData, extraData);
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
