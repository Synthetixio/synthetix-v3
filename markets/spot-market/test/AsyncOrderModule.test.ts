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
    await systems()
      .SpotMarket.connect(marketOwner)
      .addSettlementStrategy(marketId(), {
        strategyType: 0,
        settlementDelay: 5,
        settlementWindowDuration: 120,
        priceVerificationContract: ethers.constants.AddressZero,
        feedId: ethers.constants.HashZero,
        url: '',
        settlementReward: bn(5),
        priceDeviationTolerance: bn(0.01),
      });
  });

  describe('invalid market/claim ids', () => {
    it('reverts when trying to settle with invalid market id', async () => {
      await assertRevert(systems().SpotMarket.settleOrder(123123, 1), 'InvalidClaim');
    });

    it('reverts when trying to settle with non existing claim id', async () => {
      await assertRevert(systems().SpotMarket.settleOrder(marketId(), 123), 'InvalidClaim');
    });
  });

  describe('cancel order', () => {
    before('commit', async () => {
      await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(1000));
      await systems().SpotMarket.connect(trader1).commitOrder(marketId(), 2, bn(1000), 0, bn(0.8));
    });

    before('fast forward', async () => {
      await fastForwardTo((await getTime(provider())) + 5, provider());
    });

    it('fails with invalid market or claim id', async () => {
      await assertRevert(systems().SpotMarket.cancelOrder(123123, 1), 'InvalidClaim');
      await assertRevert(systems().SpotMarket.cancelOrder(marketId(), 123), 'InvalidClaim');
    });

    it('fails when within settlement window', async () => {
      await assertRevert(
        systems().SpotMarket.cancelOrder(marketId(), 1),
        'IneligibleForCancellation'
      );
    });

    describe('after settlement window', () => {
      let previousBalance: ethers.BigNumber;
      before('fast forward', async () => {
        previousBalance = await systems().USD.balanceOf(await trader1.getAddress());
        await fastForwardTo((await getTime(provider())) + 120, provider());
      });

      before('cancel order', async () => {
        await systems().SpotMarket.cancelOrder(marketId(), 1);
      });

      it('returned funds to user', async () => {
        assertBn.equal(
          await systems().USD.balanceOf(await trader1.getAddress()),
          previousBalance.add(bn(1000))
        );
      });
    });

    describe('when cancelling after already cancelled', () => {
      it('reverts', async () => {
        await assertRevert(systems().SpotMarket.cancelOrder(marketId(), 1), 'OrderAlreadySettled');
      });
    });

    describe('when attempting to settle a cancelled order', () => {
      it('reverts', async () => {
        await assertRevert(systems().SpotMarket.settleOrder(marketId(), 1), 'OrderAlreadySettled');
      });
    });
  });
});
