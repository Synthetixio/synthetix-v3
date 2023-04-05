import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { SynthRouter } from '../generated/typechain';
import { bn, bootstrapTraders, bootstrapWithSynth } from './bootstrap';

describe('AsyncOrderModule pyth', () => {
  const { systems, signers, marketId, provider } = bootstrapTraders(
    bootstrapWithSynth('Synthetic Ether', 'snxETH')
  );

  let marketOwner: ethers.Signer,
    trader1: ethers.Signer,
    keeper: ethers.Signer,
    synth: SynthRouter,
    startTime: number,
    strategyId: number,
    pythSettlementStrategy: Record<string, unknown>,
    pythCallData: string,
    extraData: string;

  before('identify', async () => {
    [, , marketOwner, trader1, , keeper] = signers();
    const synthAddress = await systems().SpotMarket.getSynth(marketId());
    synth = systems().Synth(synthAddress);
  });

  before('add settlement strategy', async () => {
    pythSettlementStrategy = {
      strategyType: 1, // pyth
      settlementDelay: 5,
      settlementWindowDuration: 120,
      priceVerificationContract: systems().OracleVerifierMock.address,
      feedId: ethers.utils.formatBytes32String('ETH/USD'),
      url: 'https://fakeapi.pyth.network/',
      settlementReward: bn(5),
      priceDeviationTolerance: bn(0.2),
      minimumUsdExchangeAmount: bn(0.000001),
      maxRoundingLoss: bn(0.000001),
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
      await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(1000));
      commitTxn = await systems()
        .SpotMarket.connect(trader1)
        .commitOrder(marketId(), 2, bn(1000), strategyId, bn(0.8), ethers.constants.AddressZero);
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
      pythCallData = ethers.utils.solidityPack(
        ['bytes32', 'uint64'],
        [pythSettlementStrategy.feedId, startTime + 5]
      );
    });

    it('reverts with offchain error', async () => {
      const functionSig = systems().SpotMarket.interface.getSighash('settlePythOrder');

      // Coverage tests use hardhat provider, and hardhat provider stringifies array differently
      const expectedUrl =
        hre.network.name === 'hardhat'
          ? `[${pythSettlementStrategy.url}]`
          : pythSettlementStrategy.url;

      await assertRevert(
        systems().SpotMarket.connect(keeper).settleOrder(marketId(), 1),
        `OffchainLookup("${
          systems().SpotMarket.address
        }", "${expectedUrl}", "${pythCallData}", "${functionSig}", "${extraData}")`
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
        await systems().OracleVerifierMock.setPrice('1100');
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
          `OrderSettled(${marketId()}, 1, ${expectedReturnAmt}, [${bn(
            9.95
          )}, 0, 0, 0], 0, "${await keeper.getAddress()}"`,
          systems().SpotMarket
        );
      });
    });
  });
});
