import { ccipReceive } from '@synthetixio/core-modules/test/helpers/ccip';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import assert from 'assert';
import { ethers } from 'ethers';
import { ElectionPeriod } from '../constants';
import { ChainSelector, integrationBootstrap } from './bootstrap';

describe('cross chain election testing', function () {
  const { chains, mothership } = integrationBootstrap();

  const fastForwardToNominationPeriod = async (provider: ethers.providers.JsonRpcProvider) => {
    const schedule = await mothership.CoreProxy.getEpochSchedule();
    await fastForwardTo(schedule.nominationPeriodStartDate.toNumber() + 10, provider);
  };

  const fastForwardToVotingPeriod = async (provider: ethers.providers.JsonRpcProvider) => {
    const schedule = await mothership.CoreProxy.getEpochSchedule();
    await fastForwardTo(schedule.votingPeriodStartDate.toNumber() + 10, provider);
  };

  let voterOnMothership: ethers.Wallet;
  let voterOnSatelliteOPGoerli: ethers.Wallet;
  let voterOnSatelliteAvalancheFuji: ethers.Wallet;

  async function _fixtureSignerOnChains() {
    const signers = await Promise.all(
      chains.map(async (chain) => {
        const { address, privateKey } = ethers.Wallet.createRandom();
        await chain.provider.send('hardhat_setBalance', [address, `0x${(1e22).toString(16)}`]);
        return new ethers.Wallet(privateKey, chain.provider);
      })
    );
    return signers;
  }

  before('set up voters', async () => {
    const result = await _fixtureSignerOnChains();
    voterOnMothership = result[0];
    voterOnSatelliteOPGoerli = result[1];
    voterOnSatelliteAvalancheFuji = result[2];
  });

  before('setup election cross chain state', async () => {
    const [mothership] = chains;
    const tx1 = await mothership.CoreProxy.initElectionModuleSatellite(420);
    const rx1 = await tx1.wait();
    const tx2 = await mothership.CoreProxy.initElectionModuleSatellite(43113);
    const rx2 = await tx2.wait();

    await ccipReceive({
      rx: rx1,
      sourceChainSelector: ChainSelector.Sepolia,
      targetSigner: voterOnSatelliteOPGoerli,
      ccipAddress: mothership.CcipRouter.address,
    });

    await ccipReceive({
      rx: rx2,
      sourceChainSelector: ChainSelector.Sepolia,
      targetSigner: voterOnSatelliteAvalancheFuji,
      ccipAddress: mothership.CcipRouter.address,
    });
  });

  describe('expected reverts', () => {
    it('cast will fail if not in voting period', async () => {
      const [, satellite1] = chains;
      const randomVoter = ethers.Wallet.createRandom().address;

      await assertRevert(
        satellite1.CoreProxy.connect(voterOnSatelliteOPGoerli).cast([randomVoter], [1000000000], {
          value: ethers.utils.parseUnits('0.05', 'gwei'),
        }),
        'NotCallableInCurrentPeriod'
      );
    });
  });

  describe('successful voting', () => {
    it('cast a vote on satellites', async function () {
      const [mothership, satellite1, satellite2] = chains;
      await satellite1.CoreProxy.setSnapshotContract(satellite1.SnapshotRecordMock.address, true);
      await satellite2.CoreProxy.setSnapshotContract(satellite2.SnapshotRecordMock.address, true);

      await fastForwardToNominationPeriod(mothership.provider);
      await mothership.CoreProxy.connect(voterOnMothership).nominate();

      await fastForwardToVotingPeriod(mothership.provider);
      await fastForwardToVotingPeriod(satellite1.provider);
      await fastForwardToVotingPeriod(satellite2.provider);

      //prepare voting for satellite1
      const snapshotId1 = await satellite1.CoreProxy.callStatic.takeVotePowerSnapshot(
        satellite1.SnapshotRecordMock.address
      );
      await satellite1.CoreProxy.takeVotePowerSnapshot(satellite1.SnapshotRecordMock.address);
      await satellite1.SnapshotRecordMock.setBalanceOfOnPeriod(
        await voterOnSatelliteOPGoerli.getAddress(),
        ethers.utils.parseEther('100'),
        snapshotId1.add(1).toString()
      );
      await satellite1.CoreProxy.prepareBallotWithSnapshot(
        satellite1.SnapshotRecordMock.address,
        await voterOnSatelliteOPGoerli.getAddress()
      );

      //prepare voting for satellite2
      const snapshotId2 = await satellite2.CoreProxy.callStatic.takeVotePowerSnapshot(
        satellite2.SnapshotRecordMock.address
      );
      await satellite2.CoreProxy.takeVotePowerSnapshot(satellite2.SnapshotRecordMock.address);
      await satellite2.SnapshotRecordMock.setBalanceOfOnPeriod(
        await voterOnSatelliteAvalancheFuji.getAddress(),
        ethers.utils.parseEther('100'),
        snapshotId2.add(1).toString()
      );
      await satellite2.CoreProxy.prepareBallotWithSnapshot(
        satellite2.SnapshotRecordMock.address,
        await voterOnSatelliteAvalancheFuji.getAddress()
      );

      //vote on satellite1
      const tx1 = await satellite1.CoreProxy.connect(voterOnSatelliteOPGoerli).cast(
        [voterOnMothership.address],
        [ethers.utils.parseEther('100')]
      );
      const rx1 = await tx1.wait();
      await ccipReceive({
        rx: rx1,
        sourceChainSelector: ChainSelector.OptimisticGoerli,
        targetSigner: voterOnMothership,
        ccipAddress: mothership.CcipRouter.address,
      });

      //vote on satellite2
      const tx2 = await satellite1.CoreProxy.connect(voterOnSatelliteAvalancheFuji).cast(
        [voterOnMothership.address],
        [ethers.utils.parseEther('100')]
      );
      const rx2 = await tx2.wait();
      await ccipReceive({
        rx: rx2,
        sourceChainSelector: ChainSelector.AvalancheFuji,
        targetSigner: voterOnMothership,
        ccipAddress: mothership.CcipRouter.address,
      });

      const hasVoted1 = await mothership.CoreProxy.hasVoted(
        await voterOnSatelliteOPGoerli.getAddress(),
        420
      );

      assert.equal(hasVoted1, true);

      const hasVoted2 = await mothership.CoreProxy.hasVoted(
        await voterOnSatelliteAvalancheFuji.getAddress(),
        43113
      );

      assert.equal(hasVoted2, true);
    });
  });

  it('shows that the current period is Administration', async function () {
    assertBn.equal(await mothership.CoreProxy.getCurrentPeriod(), ElectionPeriod.Administration);
  });

  it('The current epoch index is correct', async function () {
    assertBn.equal(await mothership.CoreProxy.getEpochIndex(), 0);
  });
});
