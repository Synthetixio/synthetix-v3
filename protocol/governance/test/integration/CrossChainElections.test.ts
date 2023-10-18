import { ccipReceive } from '@synthetixio/core-modules/test/integration/helpers/ccip';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import assert from 'assert';
import { ethers } from 'ethers';
import { ElectionPeriod } from '../constants';
import { ChainSelector, integrationBootstrap } from './bootstrap';

describe('cross chain election testing', function () {
  const { chains, mothership } = integrationBootstrap();

  const fastForwardToNominationPeriod = async (provider: any) => {
    const schedule = await mothership.CoreProxy.getEpochSchedule();
    await fastForwardTo(schedule.nominationPeriodStartDate.toNumber() + 10, provider);
  };

  const fastForwardToVotingPeriod = async (provider: any) => {
    const schedule = await mothership.CoreProxy.getEpochSchedule();
    await fastForwardTo(schedule.votingPeriodStartDate.toNumber() + 10, provider);
  };

  const setVotingPower = async (
    electionId: number,
    voter: string,
    chainId: number,
    amount: string
  ) => {
    // await mothership.CoreProxy.prepareBallotWithSnapshot(electionId, voter);
  };

  let epochStartDate: number;
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
      targetSigner: voterOnMothership,
      ccipAddress: mothership.CcipRouter.address,
    });

    await ccipReceive({
      rx: rx2,
      sourceChainSelector: ChainSelector.Sepolia,
      targetSigner: voterOnSatelliteOPGoerli,
      ccipAddress: mothership.CcipRouter.address,
    });
  });

  describe('expected reverts', () => {
    it('cast will fail if not in voting period', async () => {
      const [, satellite1] = chains;
      const randomVoter = ethers.Wallet.createRandom().address;

      await assertRevert(
        satellite1.CoreProxy.connect(voterOnMothership).cast([randomVoter], [1000000000], {
          value: ethers.utils.parseUnits('0.05', 'gwei'),
        }),
        'NotCallableInCurrentPeriod'
      );
    });
  });

  describe('successful voting', () => {
    before('assign voting power', async () => {
      const [mothership] = chains;
      await mothership.SnapshotRecordMock?.setBalanceOfOnPeriod(
        voterOnMothership.address,
        ethers.utils.parseEther('100'),
        0
      );
    });

    it.only('cast a vote on satellite', async function () {
      const [mothership, satellite1] = chains;

      await fastForwardToNominationPeriod(mothership.provider);

      await mothership.CoreProxy.connect(voterOnMothership).nominate();
      console.log('all good?');

      await fastForwardToVotingPeriod(mothership.provider);

      const tx = await satellite1.CoreProxy.cast(
        [voterOnMothership.address],
        [ethers.utils.parseEther('100')]
      );

      const rx = await tx.wait();

      await ccipReceive({
        rx,
        sourceChainSelector: ChainSelector.OptimisticGoerli,
        targetSigner: voterOnMothership,
        ccipAddress: mothership.CcipRouter.address,
      });
    });
  });

  it('shows that the current period is Administration', async function () {
    assertBn.equal(await mothership.CoreProxy.getCurrentPeriod(), ElectionPeriod.Administration);
  });

  it('The current epoch index is correct', async function () {
    assertBn.equal(await mothership.CoreProxy.getEpochIndex(), 0);
  });
});
