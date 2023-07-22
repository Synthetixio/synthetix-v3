import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { daysToSeconds } from '@synthetixio/core-utils/utils/misc/dates';
import { ethers } from 'ethers';
import { bootstrap } from '../bootstrap';
import { ElectionPeriod } from '../constants';

interface ElectionSettings {
  epochSeatCount: ethers.BigNumberish;
  minimumActiveMembers: ethers.BigNumberish;
  epochDuration: ethers.BigNumberish;
  minEpochDuration: ethers.BigNumberish;
  minNominationPeriodDuration: ethers.BigNumberish;
  minVotingPeriodDuration: ethers.BigNumberish;
  maxDateAdjustmentTolerance: ethers.BigNumberish;
}

describe('ElectionSettings', function () {
  const { c, getSigners, getProvider, snapshotCheckpoint } = bootstrap();

  let owner: ethers.Signer;
  let user: ethers.Signer;

  before('identify signers', function () {
    [owner, user] = getSigners();
  });

  describe('#getElectionSettings', function () {
    it('returns current election settings', async function () {
      const settings = await c.CoreProxy.connect(user).getElectionSettings();
      assertBn.gt(settings.epochSeatCount, 0);
      assertBn.gt(settings.minimumActiveMembers, 0);
      assertBn.gt(settings.epochDuration, 0);
      assertBn.gt(settings.minEpochDuration, 0);
      assertBn.gt(settings.minNominationPeriodDuration, 0);
      assertBn.gt(settings.minVotingPeriodDuration, 0);
      assertBn.gt(settings.maxDateAdjustmentTolerance, 0);
    });
  });

  describe('#getNextElectionSettings', function () {
    it('returns current election settings', async function () {
      const settings = await c.CoreProxy.connect(user).getNextElectionSettings();
      assertBn.gt(settings.epochSeatCount, 0);
      assertBn.gt(settings.minimumActiveMembers, 0);
      assertBn.gt(settings.epochDuration, 0);
      assertBn.gt(settings.minEpochDuration, 0);
      assertBn.gt(settings.minNominationPeriodDuration, 0);
      assertBn.gt(settings.minVotingPeriodDuration, 0);
      assertBn.gt(settings.maxDateAdjustmentTolerance, 0);
    });
  });

  describe('#setNextElectionSettings', function () {
    async function _setNextElectionSettings(
      settings: Partial<ElectionSettings> = {},
      caller = owner
    ) {
      const tx = await c.CoreProxy.connect(caller).setNextElectionSettings(
        settings.epochSeatCount ?? 2,
        settings.minimumActiveMembers ?? 1,
        settings.epochDuration ?? 90,
        settings.minEpochDuration ?? 7,
        settings.minNominationPeriodDuration ?? 2,
        settings.minVotingPeriodDuration ?? 2,
        settings.maxDateAdjustmentTolerance ?? 2
      );
      await tx.wait();
      return tx;
    }

    describe('with an account that does not own the instance', function () {
      it('reverts', async function () {
        await assertRevert(_setNextElectionSettings({}, user), 'Unauthorized');
      });
    });

    describe('with invalid settings', function () {
      const testCases = [
        { epochSeatCount: 1, minimumActiveMembers: 2 },
        { epochDuration: 7, minEpochDuration: 8 },
        { minEpochDuration: 4, minNominationPeriodDuration: 3, minVotingPeriodDuration: 3 },
      ];

      for (const settings of testCases) {
        it(`reverts when using ${JSON.stringify(settings)}`, async function () {
          await assertRevert(_setNextElectionSettings(settings), 'InvalidElectionSettings');
        });
      }
    });

    describe('with valid settings', function () {
      it('shows the current schedule', async function () {
        const newSettings = {
          epochSeatCount: 5,
          minimumActiveMembers: 2,
          epochDuration: 60,
          minEpochDuration: 30,
          minNominationPeriodDuration: 7,
          minVotingPeriodDuration: 7,
          maxDateAdjustmentTolerance: 7,
        };

        await _setNextElectionSettings(newSettings);

        const result = await c.CoreProxy.getNextElectionSettings();

        for (const [k, v] of Object.entries(newSettings)) {
          assertBn.equal(result[k], v);
        }
      });
    });

    // TODO: test callable only during Administration
  });
});
