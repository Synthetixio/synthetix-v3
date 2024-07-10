import { equal } from 'node:assert/strict';
import { typedValues } from '../helpers/object';
// import { ethers } from 'ethers';
import { integrationBootstrap, WormholeChainSelector } from './bootstrap';

// import { WormholeMock__factory } from '../generated/typechain';

describe('cross chain nft distribution', function () {
  const { chains } = integrationBootstrap();

  before('register emitters', async function () {
    for (const chain of typedValues(chains)) {
      const _chains = [
        WormholeChainSelector.mothership,
        WormholeChainSelector.satellite1,
        WormholeChainSelector.satellite2,
      ];
      const _emitters = [
        chains.mothership.GovernanceProxy.address,
        chains.satellite1.GovernanceProxy.address,
        chains.satellite2.GovernanceProxy.address,
      ];
      await chain.GovernanceProxy.connect(chain.signer).setRegisteredEmitters(_chains, _emitters);
    }
  });

  it('allows owner mint nft', async function () {
    for (const chain of Object.values(chains)) {
      const ownerAddress = await chain.signer.getAddress();
      equal((await chain.CouncilToken.balanceOf(ownerAddress)).toString(), '1');
    }
  });

  //   it.only('dimisses members', async function () {
  //     const ownerAddress = await chains.mothership.signer.getAddress();
  //     const tx = await chains.mothership.GovernanceProxy.dismissMembers([
  //       await chains.mothership.signer.getAddress(),
  //     ]);
  //     const rx = await tx.wait();

  //     // TODO use json abi here
  //     const abi = [
  //       'event LogMessagePublished(address indexed sender, uint64 sequence, uint32 nonce, bytes payload, uint8 consistencyLevel)',
  //     ];
  //     const iface = new ethers.utils.Interface(abi);

  //     console.log('rx: ', rx);

  //     // Parsing the last event from the receipt
  //     const events = [];

  //     for (const evt of rx.events!) {
  //       try {
  //         events.push(iface.parseLog(evt));
  //       } catch (_) {
  //         // If the event is not parsed is not the one we are looking for
  //       }
  //     }

  //     if (events.length === 0) {
  //       throw new Error('Could not find cross chain event');
  //     }

  //     console.log(events);

  //     await chains.satellite1.WormholeRelayerMock.deliver(
  //       [encodedValue1],
  //       event?.args?.payload,
  //       await voter.satellite1.getAddress(),
  //       []
  //     );
  //   });
});
