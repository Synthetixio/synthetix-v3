import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { daysToSeconds } from '@synthetixio/core-utils/utils/misc/dates';
import { ethers } from 'ethers';
import { bootstrap } from '../bootstrap';

interface ElectionSettings {
  epochSeatCount: ethers.BigNumberish;
  minimumActiveMembers: ethers.BigNumberish;
  epochDuration: ethers.BigNumberish;
  nominationPeriodDuration: ethers.BigNumberish;
  votingPeriodDuration: ethers.BigNumberish;
  maxDateAdjustmentTolerance: ethers.BigNumberish;
}

describe('ElectionSettings', function () {
  const { c, getSigners } = bootstrap();

  let owner: ethers.Signer;
  let user: ethers.Signer;

  before('identify signers', function () {
    [owner, user] = getSigners();
  });

  describe('#getElectionSettings', function () {
    it('returns current election settings', async function () {
      const settings = await c.GovernanceProxy.connect(user).getElectionSettings();
      assertBn.gt(settings.epochSeatCount, 0);
      assertBn.gt(settings.minimumActiveMembers, 0);
      assertBn.gt(settings.epochDuration, 0);
      assertBn.gt(settings.nominationPeriodDuration, 0);
      assertBn.gt(settings.votingPeriodDuration, 0);
      assertBn.gt(settings.maxDateAdjustmentTolerance, 0);
    });
  });

  describe('#setNextElectionSettings', function () {
    async function _setNextElectionSettings(
      settings: Partial<ElectionSettings> = {},
      caller = owner
    ) {
      const tx = await c.GovernanceProxy.connect(caller).setNextElectionSettings(
        settings.epochSeatCount ?? 2,
        settings.minimumActiveMembers ?? 1,
        settings.epochDuration ?? 90,
        settings.nominationPeriodDuration ?? 2,
        settings.votingPeriodDuration ?? 2,
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
        { epochSeatCount: 0 },
        { minimumActiveMembers: 0 },
        { epochDuration: 0 },
        { nominationPeriodDuration: 0 },
        { votingPeriodDuration: 0 },
        { epochSeatCount: 1, minimumActiveMembers: 2 },
        {
          epochDuration: daysToSeconds(4),
          nominationPeriodDuration: daysToSeconds(3),
          votingPeriodDuration: daysToSeconds(3),
        },
        { nominationPeriodDuration: daysToSeconds(1) - 1 },
        { votingPeriodDuration: daysToSeconds(1) - 1 },
        {
          nominationPeriodDuration: daysToSeconds(2),
          maxDateAdjustmentTolerance: daysToSeconds(2),
        },
        {
          votingPeriodDuration: daysToSeconds(2),
          maxDateAdjustmentTolerance: daysToSeconds(2),
        },
      ];

      for (const settings of testCases) {
        it(`reverts when using ${JSON.stringify(settings)}`, async function () {
          await assertRevert(_setNextElectionSettings(settings), 'InvalidElectionSettings');
        });
      }
    });

    describe('with valid settings', function () {
      it('sets new settings for next epoch', async function () {
        const newSettings = {
          epochSeatCount: 5,
          minimumActiveMembers: 2,
          epochDuration: 30,
          nominationPeriodDuration: 7,
          votingPeriodDuration: 7,
          maxDateAdjustmentTolerance: 3,
        } as ElectionSettings;

        await _setNextElectionSettings(newSettings);

        const result = await c.GovernanceProxy.getNextElectionSettings();

        assertBn.equal(result.epochSeatCount, newSettings.epochSeatCount);
        assertBn.equal(result.minimumActiveMembers, newSettings.minimumActiveMembers);
        assertBn.equal(result.epochDuration, daysToSeconds(newSettings.epochDuration as number));
        assertBn.equal(
          result.nominationPeriodDuration,
          daysToSeconds(newSettings.nominationPeriodDuration as number)
        );
        assertBn.equal(
          result.votingPeriodDuration,
          daysToSeconds(newSettings.votingPeriodDuration as number)
        );
        assertBn.equal(
          result.maxDateAdjustmentTolerance,
          daysToSeconds(newSettings.maxDateAdjustmentTolerance as number)
        );
      });
    });
  });
});
