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
      const settings = await c.CoreProxy.connect(user).getElectionSettings();
      assertBn.gt(settings.epochSeatCount, 0);
      assertBn.gt(settings.minimumActiveMembers, 0);
      assertBn.gt(settings.epochDuration, 0);
      assertBn.gt(settings.nominationPeriodDuration, 0);
      assertBn.gt(settings.votingPeriodDuration, 0);
      assertBn.gt(settings.maxDateAdjustmentTolerance, 0);
    });
  });

  describe('#getNextElectionSettings', function () {
    it('returns current election settings', async function () {
      const settings = await c.CoreProxy.connect(user).getNextElectionSettings();
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
      const tx = await c.CoreProxy.connect(caller).setNextElectionSettings(
        settings.epochSeatCount ?? 2,
        settings.minimumActiveMembers ?? 1,
        settings.epochDuration ?? daysToSeconds(90),
        settings.nominationPeriodDuration ?? daysToSeconds(2),
        settings.votingPeriodDuration ?? daysToSeconds(2),
        settings.maxDateAdjustmentTolerance ?? daysToSeconds(2)
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
        { epochDuration: 4, nominationPeriodDuration: 3, votingPeriodDuration: 3 },
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
          epochDuration: daysToSeconds(30),
          nominationPeriodDuration: daysToSeconds(7),
          votingPeriodDuration: daysToSeconds(7),
          maxDateAdjustmentTolerance: daysToSeconds(7),
        } satisfies ElectionSettings;

        await _setNextElectionSettings(newSettings);

        const result = await c.CoreProxy.getNextElectionSettings();

        for (const k of Object.keys(newSettings)) {
          const key = k as keyof ElectionSettings;
          assertBn.equal(result[key], newSettings[key]);
        }
      });
    });

    // TODO: test callable only during Administration
  });
});
