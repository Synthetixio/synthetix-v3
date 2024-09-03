import { ethers } from 'ethers';
import { equal } from 'node:assert/strict';
import { integrationBootstrap, WormholeChainSelector } from './bootstrap';

describe('cross chain nft distribution', function () {
  const { chains, fixtureSignerOnChains } = integrationBootstrap();
  it('allows owner mint nft', async function () {
    for (const chain of Object.values(chains)) {
      const ownerAddress = await chain.signer.getAddress();
      equal((await chain.CouncilToken.balanceOf(ownerAddress)).toString(), '1');
    }
  });

  it('dimisses members', async function () {
    const voter = await fixtureSignerOnChains();
    const ownerAddress = await chains.mothership.signer.getAddress();
    const tx = await chains.mothership.GovernanceProxy.dismissMembers([ownerAddress]);
    const rx = await tx.wait();

    // TODO use json abi here
    const abi = [
      'event LogMessagePublished(address indexed sender, uint64 sequence, uint32 nonce, bytes payload, uint8 consistencyLevel)',
    ];
    const iface = new ethers.utils.Interface(abi);

    // Parsing the last event from the receipt
    const events = [];

    for (const evt of rx.events!) {
      try {
        events.push(iface.parseLog(evt));
      } catch {
        // If the event is not parsed is not the one we are looking for
      }
    }

    if (events.length === 0) {
      throw new Error('Could not find cross chain event');
    }

    const encodedValue1 = ethers.utils.defaultAbiCoder.encode(
      ['address', 'uint16', 'uint64'], // Types
      [
        chains.mothership.GovernanceProxy.address,
        WormholeChainSelector.satellite1,
        events[0].args?.sequence,
      ] // Values
    );

    const encodedValue2 = ethers.utils.defaultAbiCoder.encode(
      ['address', 'uint16', 'uint64'], // Types
      [
        chains.mothership.GovernanceProxy.address,
        WormholeChainSelector.satellite2,
        events[1].args?.sequence,
      ] // Values
    );

    await chains.satellite1.WormholeRelayerMock.deliver(
      [encodedValue1],
      events[0]?.args?.payload,
      await voter.satellite1.getAddress(),
      []
    );
    await chains.satellite2.WormholeRelayerMock.deliver(
      [encodedValue2],
      events[1]?.args?.payload,
      await voter.satellite2.getAddress(),
      []
    );

    equal((await chains.satellite1.CouncilToken.balanceOf(ownerAddress)).toString(), '0');
    equal((await chains.satellite2.CouncilToken.balanceOf(ownerAddress)).toString(), '0');
  });
});
