import { ethers } from 'ethers';
import { bn, bootstrapTraders, bootstrapWithSynth } from './bootstrap';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { SynthRouter } from './generated/typechain';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';

const settlementStrategy = {
  strategyType: 0,
  settlementDelay: 5,
  settlementWindowDuration: 120,
  priceVerificationContract: ethers.constants.AddressZero,
  feedId: ethers.constants.HashZero,
  url: '',
  settlementReward: bn(5),
  disabled: false,
  priceDeviationTolerance: bn(0.01),
  minimumUsdExchangeAmount: bn(0.000001),
  maxRoundingLoss: bn(0.000001),
};

const ASYNC_BUY_TRANSACTION = 3,
  ASYNC_SELL_TRANSACTION = 4;

describe('AsyncOrderModule onchain', () => {
  const { systems, signers, marketId, provider } = bootstrapTraders(
    bootstrapWithSynth('Synthetic Ether', 'snxETH')
  ); // creates traders with USD

  let marketOwner: ethers.Signer,
    trader1: ethers.Signer,
    keeper: ethers.Signer,
    synth: SynthRouter,
    startTime: number,
    strategyId: number;

  before('identify', async () => {
    [, , marketOwner, trader1, , , , keeper] = signers();
    const synthAddress = await systems().SpotMarket.getSynth(marketId());
    synth = systems().Synth(synthAddress);
  });

  before('add settlement strategy', async () => {
    strategyId = (
      await systems()
        .SpotMarket.connect(marketOwner)
        .callStatic.addSettlementStrategy(marketId(), settlementStrategy)
    ).toNumber();
    await systems()
      .SpotMarket.connect(marketOwner)
      .addSettlementStrategy(marketId(), settlementStrategy);
  });

  before('setup fixed fee', async () => {
    await systems().SpotMarket.connect(marketOwner).setAsyncFixedFee(marketId(), bn(0.01));
  });

  describe('commitOrder', () => {
    it('reverts on invalid market', async () => {
      await assertRevert(
        systems().SpotMarket.commitOrder(
          25,
          ASYNC_BUY_TRANSACTION,
          bn(1000),
          1,
          bn(1),
          ethers.constants.AddressZero
        ),
        'InvalidMarket'
      );
    });

    it('reverts on invalid strategy', async () => {
      await assertRevert(
        systems().SpotMarket.commitOrder(
          marketId(),
          ASYNC_BUY_TRANSACTION,
          bn(1000),
          5,
          bn(1),
          ethers.constants.AddressZero
        ),
        'InvalidSettlementStrategy'
      );
    });

    it('reverts on invalid order type', async () => {
      await assertRevert(
        systems().SpotMarket.commitOrder(
          marketId(),
          1,
          bn(1000),
          5,
          bn(1),
          ethers.constants.AddressZero
        ),
        'InvalidAsyncTransactionType'
      );
    });

    describe('commit buy', () => {
      it('reverts on amount lower than keeper fee', async () => {
        await assertRevert(
          systems()
            .SpotMarket.connect(trader1)
            .commitOrder(
              marketId(),
              ASYNC_BUY_TRANSACTION,
              bn(1),
              strategyId,
              bn(1),
              ethers.constants.AddressZero
            ),
          'InvalidCommitmentAmount'
        );
      });

      describe('on success', () => {
        let commitTxn: ethers.providers.TransactionResponse;

        before('commit', async () => {
          startTime = await getTime(provider());
          await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(1000));
          commitTxn = await systems()
            .SpotMarket.connect(trader1)
            .commitOrder(
              marketId(),
              ASYNC_BUY_TRANSACTION,
              bn(1000),
              0,
              bn(0.8),
              ethers.constants.AddressZero
            );
        });

        it('emits event', async () => {
          await assertEvent(
            commitTxn,
            `OrderCommitted(${marketId()}, ${ASYNC_BUY_TRANSACTION}, ${bn(
              1000
            )}, 1, "${await trader1.getAddress()}"`,
            systems().SpotMarket
          );
        });
      });
    });

    describe('settle buy', () => {
      const expectedOrderId = 1;

      it('reverts if called prior to settlement delay', async () => {
        await assertRevert(
          systems().SpotMarket.connect(keeper).settleOrder(marketId(), expectedOrderId),
          'OutsideSettlementWindow'
        );
      });

      describe('after one block', () => {
        let withdrawableUsd: ethers.BigNumber, settleTxn: ethers.providers.TransactionResponse;
        before('fast forward', async () => {
          withdrawableUsd = await systems().Core.getWithdrawableMarketUsd(marketId());
          await fastForwardTo(startTime + 6, provider());
        });

        before('settle', async () => {
          settleTxn = await systems()
            .SpotMarket.connect(keeper)
            .settleOrder(marketId(), expectedOrderId);
        });

        // $1000/eth; 1000 - $5 keeper fee - 1% async fixed fee = $.98505
        const expectedSynthAmount = bn(0.98505);
        it('sent correct amount to trader', async () => {
          assertBn.equal(await synth.balanceOf(await trader1.getAddress()), expectedSynthAmount);
        });

        it('sent reward to keeper', async () => {
          assertBn.equal(await systems().USD.balanceOf(await keeper.getAddress()), bn(5));
        });

        it('deposited correct usd amt into market manager', async () => {
          assertBn.equal(
            await systems().Core.getWithdrawableMarketUsd(marketId()),
            withdrawableUsd.add(bn(995))
          );
        });

        it('emitted event', async () => {
          await assertEvent(
            settleTxn,
            `OrderSettled(${marketId()}, 1, ${expectedSynthAmount}, [${bn(
              9.95
            )}, 0, 0, 0], 0, "${await keeper.getAddress()}"`,
            systems().SpotMarket
          );
        });
      });

      describe('settle again', () => {
        it('reverts if attempting to settle again', async () => {
          await assertRevert(
            systems().SpotMarket.connect(keeper).settleOrder(marketId(), 1),
            'OrderAlreadySettled'
          );
        });
      });
    });

    describe('commit sell', () => {
      let commitTxn: ethers.providers.TransactionResponse;

      before('commit', async () => {
        startTime = await getTime(provider());
        await synth.connect(trader1).approve(systems().SpotMarket.address, bn(0.5));
        commitTxn = await systems()
          .SpotMarket.connect(trader1)
          .commitOrder(
            marketId(),
            ASYNC_SELL_TRANSACTION,
            bn(0.5),
            strategyId,
            bn(200),
            ethers.constants.AddressZero
          );
      });

      it('emits event', async () => {
        await assertEvent(
          commitTxn,
          `OrderCommitted(${marketId()}, ${ASYNC_SELL_TRANSACTION}, ${bn(
            0.5
          )}, 2, "${await trader1.getAddress()}"`,
          systems().SpotMarket
        );
      });
    });

    describe('settle sell', () => {
      it('reverts if called prior to settlement delay', async () => {
        await assertRevert(
          systems().SpotMarket.connect(keeper).settleOrder(marketId(), 2),
          'OutsideSettlementWindow'
        );
      });

      describe('after settlement delay passes', () => {
        let withdrawableUsd: ethers.BigNumber,
          traderBalance: ethers.BigNumber,
          settleTxn: ethers.providers.TransactionResponse;
        before('fast forward', async () => {
          traderBalance = await systems().USD.balanceOf(await trader1.getAddress());
          withdrawableUsd = await systems().Core.getWithdrawableMarketUsd(marketId());
          await fastForwardTo(startTime + 6, provider());
        });

        before('settle', async () => {
          settleTxn = await systems().SpotMarket.connect(keeper).settleOrder(marketId(), 2);
        });

        // $900/eth: 0.5 * 900 - 5 keeper fee - 1% async fixed fee = $440.5
        const expectedReturnAmt = bn(440.5);
        it('sent correct amount to trader', async () => {
          assertBn.equal(
            await systems().USD.balanceOf(await trader1.getAddress()),
            traderBalance.add(expectedReturnAmt)
          );
        });

        it('sent reward to keeper', async () => {
          assertBn.equal(await systems().USD.balanceOf(await keeper.getAddress()), bn(10));
        });

        it('withdrew correct usd amt into market manager', async () => {
          assertBn.equal(
            await systems().Core.getWithdrawableMarketUsd(marketId()),
            withdrawableUsd.sub(bn(450 - 4.5))
          );
        });

        it('emitted event', async () => {
          await assertEvent(
            settleTxn,
            `OrderSettled(${marketId()}, 2, ${expectedReturnAmt}, [${bn(
              4.5
            )}, 0, 0, 0], 0, "${await keeper.getAddress()}"`,
            systems().SpotMarket
          );
        });
      });
    });
  });
});
