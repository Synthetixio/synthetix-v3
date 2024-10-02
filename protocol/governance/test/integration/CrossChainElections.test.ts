import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assert from 'assert';
import { ethers } from 'ethers';
import { ElectionPeriod } from '../constants';
import { typedEntries, typedValues } from '../helpers/object';
import { integrationBootstrap, SignerOnChains, WormholeChainSelector } from './bootstrap';

describe('cross chain election testing', function () {
  const { chains, fixtureSignerOnChains, fastForwardChainsTo } = integrationBootstrap();

  const fastForwardToNominationPeriod = async () => {
    const schedule = await chains.mothership.GovernanceProxy.getEpochSchedule();
    await fastForwardChainsTo(schedule.nominationPeriodStartDate.toNumber() + 10);
  };

  const fastForwardToVotingPeriod = async () => {
    const schedule = await chains.mothership.GovernanceProxy.getEpochSchedule();
    await fastForwardChainsTo(schedule.votingPeriodStartDate.toNumber() + 10);
  };

  const deliverCrossChainCast = async (
    tx: ethers.ContractTransaction,
    emitterAddress: string,
    emitterChainId: string
  ) => {
    const rx = await tx.wait();

    const abi = [
      'event LogMessagePublished(address indexed sender, uint64 sequence, uint32 nonce, bytes payload, uint8 consistencyLevel)',
    ];
    const iface = new ethers.utils.Interface(abi);

    // Parsing the last event from the receipt
    let event: ethers.utils.LogDescription | null = null;

    for (const evt of rx.events!) {
      try {
        event = iface.parseLog(evt);
      } catch {
        // If the event is not parsed is not the one we are looking for
      }
    }

    if (!event) {
      throw new Error('Could not find cross chain event');
    }

    const encodedValue = ethers.utils.defaultAbiCoder.encode(
      ['address', 'uint16', 'uint64'], // Types
      [emitterAddress, emitterChainId, event.args?.sequence] // Values
    );

    console.log('WormholeRelayerMock address: ', chains.mothership.WormholeRelayerMock.address);
    console.log(
      'WormholeRelayerMock address on gov proxy: ',
      await chains.mothership.GovernanceProxy.getWormholeRelayer()
    );

    // request delivery from wormhole standard relayer on the mothership chain
    await chains.mothership.WormholeRelayerMock.deliver(
      [encodedValue],
      event?.args?.payload,
      await voter.satellite1.getAddress(),
      []
    );
  };

  let nominee: SignerOnChains;
  let voter: SignerOnChains;

  before('set up users', async function () {
    nominee = await fixtureSignerOnChains();
    voter = await fixtureSignerOnChains();
  });

  describe('on initialization', function () {
    it('shows that the current period is Administration', async function () {
      assertBn.equal(
        await chains.mothership.GovernanceProxy.getCurrentPeriod(),
        ElectionPeriod.Administration
      );
    });

    it('the current epoch index is correct', async function () {
      assertBn.equal(await chains.mothership.GovernanceProxy.getEpochIndex(), 0);
    });
  });

  describe('expected reverts', function () {
    it('cast will fail if not in voting period', async function () {
      const randomCandidate = ethers.Wallet.createRandom().address;

      await assertRevert(
        chains.satellite1.GovernanceProxy.connect(voter.satellite1).cast(
          [randomCandidate],
          [1000000000],
          {
            value: ethers.utils.parseUnits('0.05', 'gwei'),
          }
        ),
        'NotCallableInCurrentPeriod'
      );
    });
  });

  describe('successful voting on all chains', function () {
    before('prepare snapshot record on all chains', async function () {
      for (const chain of typedValues(chains)) {
        const tx = await chain.GovernanceProxy.connect(chain.signer).setSnapshotContract(
          chain.SnapshotRecordMock.address,
          0,
          ethers.utils.parseEther('0'),
          true
        );
        await tx.wait();
      }
    });

    before('nominate', async function () {
      await fastForwardToNominationPeriod();
      await chains.mothership.GovernanceProxy.connect(nominee.mothership).nominate();
    });

    before('preapare ballots on all chains', async function () {
      await fastForwardToVotingPeriod();

      for (const [chainName, chain] of typedEntries(chains)) {
        const snapshotId1 = await chain.GovernanceProxy.callStatic.takeVotePowerSnapshot(
          chain.SnapshotRecordMock.address
        );
        await chain.GovernanceProxy.takeVotePowerSnapshot(chain.SnapshotRecordMock.address);
        await chain.SnapshotRecordMock.setBalanceOfOnPeriod(
          await voter[chainName].getAddress(),
          100,
          snapshotId1.toString()
        );
        await chain.GovernanceProxy.prepareBallotWithSnapshot(
          chain.SnapshotRecordMock.address,
          await voter[chainName].getAddress()
        );
      }
    });

    it('casts vote on mothership', async function () {
      const { mothership } = chains;

      const tx = await mothership.GovernanceProxy.connect(voter.mothership).cast(
        [await nominee.mothership.getAddress()],
        [10],
        {
          gasLimit: 9000000,
        }
      );
      await tx.wait();

      const hasVoted = await mothership.GovernanceProxy.hasVoted(
        await voter.mothership.getAddress(),
        chains.mothership.chainId
      );

      assert.equal(hasVoted, true);
    });

    it('casts vote on satellite1', async function () {
      const { mothership, satellite1 } = chains;

      const tx = await satellite1.GovernanceProxy.connect(voter.satellite1).cast(
        [await nominee.mothership.getAddress()],
        [10]
      );

      await deliverCrossChainCast(
        tx,
        chains.satellite1.GovernanceProxy.address,
        WormholeChainSelector.satellite1
      );

      const hasVoted = await mothership.GovernanceProxy.hasVoted(
        await voter.satellite1.getAddress(),
        chains.satellite1.chainId
      );

      assert.equal(hasVoted, true);
    });

    it('casts vote on satellite2', async function () {
      const { mothership, satellite2 } = chains;

      const tx = await satellite2.GovernanceProxy.connect(voter.satellite2).cast(
        [await nominee.mothership.getAddress()],
        [10]
      );

      await deliverCrossChainCast(
        tx,
        chains.satellite2.GovernanceProxy.address,
        WormholeChainSelector.satellite2
      );

      const hasVoted = await mothership.GovernanceProxy.hasVoted(
        await voter.satellite2.getAddress(),
        chains.satellite2.chainId
      );

      assert.equal(hasVoted, true);
    });

    it('successfully removes network and emitter', async function () {
      const { mothership } = chains;

      let registeredEmitters = await mothership.GovernanceProxy.getRegisteredEmitters();
      let supportedNetworks = await mothership.GovernanceProxy.getSupportedNetworks();

      assert.equal(registeredEmitters.length, 3);
      assert.equal(supportedNetworks.length, 3);

      const tx = await mothership.GovernanceProxy.removeRegisteredEmitters([
        WormholeChainSelector.satellite1,
      ]);
      await tx.wait();

      registeredEmitters = await mothership.GovernanceProxy.getRegisteredEmitters();
      supportedNetworks = await mothership.GovernanceProxy.getSupportedNetworks();

      assert.equal(registeredEmitters.length, 2);
      assert.equal(supportedNetworks.length, 2);
    });
  });
});
