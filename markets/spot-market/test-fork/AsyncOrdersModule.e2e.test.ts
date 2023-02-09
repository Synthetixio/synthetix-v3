import { Contract } from 'ethers';
import hre from 'hardhat';
import { ethers as Ethers } from 'ethers';
import { bn, bootstrapTraders, bootstrapWithSynth } from '../test/bootstrap';
import { MinEthersFactory } from '../typechain-types/common';
import { SynthRouter } from '../generated/typechain';
import { snapshotCheckpoint } from '../../legacy-market/test/utils';
import assertBignumber from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';

describe('AsyncOrdersModule.e2e.test', function () {
  const { systems, signers, marketId, provider } = bootstrapTraders(
    bootstrapWithSynth('Synthetic Ether', 'snxETH')
  );
  // creates traders with USD

  let owner: Ethers.Signer, trader1: Ethers.Signer, trader2: Ethers.Signer;
  let synth: SynthRouter;

  let initialTrader1Balance: Ethers.BigNumber, initialTrader2Balance: Ethers.BigNumber;

  before('identify actors', async () => {
    [owner] = signers();
  });

  before('identify synth', async () => {
    const synthAddress = await systems().SpotMarket.getSynth(1);
    synth = systems().Synth(synthAddress);
  });

  before('setup traders', async () => {
    await systems().USD.connect(owner).approve(systems().SpotMarket.address, bn(10_000));
    await systems().SpotMarket.connect(owner).buy(marketId(), bn(10_000), bn(10));
    // await systems().USD.connect(trader2).approve(systems().SpotMarket.address, bn(10_000));
    // await systems().SpotMarket.connect(trader2).buy(marketId(), bn(10_000), bn(10));
  });

  const restore = snapshotCheckpoint(provider);

  before('identify initial trader balances', async () => {
    initialTrader1Balance = await systems().USD.balanceOf(await owner.getAddress());
  });

  it('Should be able to buy and sell with the Chainlink settlement strategy', async function () {
    await systems().USD.connect(owner).approve(systems().SpotMarket.address, bn(1000));
    await systems().SpotMarket.connect(owner).buy(marketId(), bn(1000), bn(1));

    // const usdt = await hre.ethers.getContractAt(
    //   'IERC20',
    //   '0xe802376580c10fe23f027e1e19ed9d54d4c9311e'
    // );

    // console.log(await usdt.decimals());
  });

  it('trader1 has 1 snxETH', async () => {
    assertBignumber.equal(await synth.balanceOf(await owner.getAddress()), bn(1));
  });
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
