import { Contract } from 'ethers';
import hre from 'hardhat';
import { ethers } from 'ethers';
import { bn, bootstrapTraders, bootstrapWithSynth } from '../test/bootstrap';
import { MinEthersFactory } from '../typechain-types/common';
import { SynthRouter } from '../generated/typechain';
import { snapshotCheckpoint } from '../../legacy-market/test/utils';
import assertBignumber from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';

const feedId = '0xca80ba6dc32e08d06f1aa886011eed1d77c77be9eb761cc10d72b7d0a2fd57a6';
const pythAPI = `https://xc-testnet.pyth.network/api/latest_vaas?ids[]=${feedId}`;
const feedAddress = '0xff1a0f4744e8582DF1aE09D5611b887B6a12925C';

describe('AsyncOrdersModule.e2e.test', function () {
  const { systems, signers, marketId, provider } = bootstrapTraders(
    bootstrapWithSynth('Synthetic Ether', 'snxETH')
  );
  // creates traders with USD

  let owner: ethers.Signer;

  let keeper: ethers.Signer,
    synth: SynthRouter,
    startTime: number,
    strategyId: number,
    pythSettlementStrategy: Record<string, unknown>,
    pythCallData: string,
    extraData: string;

  before('identify', async () => {
    [owner] = signers();
    const synthAddress = await systems().SpotMarket.getSynth(marketId());
    synth = systems().Synth(synthAddress);
  });

  before('add settlement strategy', async () => {
    pythSettlementStrategy = {
      strategyType: 2,
      settlementDelay: 5,
      settlementWindowDuration: 120,
      priceVerificationContract: feedAddress,
      feedId,
      url: 'https://xc-mainnet.pyth.network/api/get_vaa_ccip?data={data}',
      settlementReward: bn(5),
      priceDeviationTolerance: bn(1000),
    };

    strategyId = await systems()
      .SpotMarket.connect(owner)
      .callStatic.addSettlementStrategy(marketId(), pythSettlementStrategy);
    await systems()
      .SpotMarket.connect(owner)
      .addSettlementStrategy(marketId(), pythSettlementStrategy);
  });

  before('setup fixed fee', async () => {
    await systems().SpotMarket.connect(owner).setAsyncFixedFee(marketId(), bn(0.01));
  });

  describe('commit order', () => {
    let commitTxn: ethers.providers.TransactionResponse;
    before('commit', async () => {
      await systems().USD.connect(owner).approve(systems().SpotMarket.address, bn(1000));
      commitTxn = await systems()
        .SpotMarket.connect(owner)
        .commitOrder(marketId(), 2, bn(1000), strategyId, bn(0.8));
      startTime = await getTime(provider());
    });

    it('emits event', async () => {
      await assertEvent(
        commitTxn,
        `OrderCommitted(${marketId()}, 2, ${bn(1000)}, 1, "${await owner.getAddress()}"`,
        systems().SpotMarket
      );
    });
  });

  // it('trader1 has 1 snxETH', async () => {
  //   assertBignumber.equal(await synth.balanceOf(await owner.getAddress()), bn(1));
  // });
  //   expect(await Greeter.greet()).to.equal('Hello world!');

  //   const setGreetingTx = await Greeter.setGreeting('Hola mundo!');

  //   // wait until the transaction is mined
  //   await setGreetingTx.wait();

  //   expect(await Greeter.greet()).to.equal('Hola mundo!');

  // Build the chain state
  // `cannon build --chain-id ${CHAIN_ID} user=${publicKey} chainlinkAggregatorAddress=${}`

  // Require them
  // const x = require('');

  // Create an order commitment
  // MarketProxy.commitBuyOrder()

  // Attempt to settle and receive the information from the revert

  // Poll the off-chain API until the data is available

  // Settle the order

  //   const tx = await signer.sendTransaction({
  //     to: '<to_account>',
  //     value: ethers.utils.parseUnits('0.001', 'ether'),
  //   });
  //   console.log('Mining transaction...');
  //   console.log(`https://${network}.etherscan.io/tx/${tx.hash}`);
  //   // Waiting for the transaction to be mined
  //   const receipt = await tx.wait();
  //   // The transaction is now on chain!
  //   console.log(`Mined in block ${receipt.blockNumber}`);
  // });
});
