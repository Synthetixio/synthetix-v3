import { deepEqual } from 'node:assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { ethers } from 'ethers';
import { ElectionPeriod } from '../../constants';
import { bootstrap } from '../bootstrap';

function _sortedDeepEqual(actual: string[], expected: string[]) {
  deepEqual([...actual].sort(), [...expected].sort());
}

describe('ElectionModule - council members', function () {
  const { c, getSigners, snapshotCheckpoint } = bootstrap();

  let members: string[];

  const MINIMUM_COUNCIL_MEMBERS = 3;

  before('identify signers', async function () {
    members = await Promise.all(
      getSigners()
        .slice(1, 5)
        .map((m) => m.getAddress())
    );
  });

  before('update settings', async function () {
    await c.GovernanceProxy.ElectionSettings_set_minimumActiveMembers(
      0,
      MINIMUM_COUNCIL_MEMBERS
    ).then((tx) => tx.wait());
  });

  before('prepare council members', async function () {
    await c.GovernanceProxy.removeAllCouncilMembersMock(0).then((tx) => tx.wait());
    await c.GovernanceProxy.addCouncilMembersMock(members, 0).then((tx) => tx.wait());
  });

  it('lists all members', async function () {
    deepEqual(await c.GovernanceProxy.getCouncilMembers(), members);
  });

  describe('#dismissMembers', function () {
    snapshotCheckpoint();

    let receipt: ethers.ContractReceipt;

    before('dismiss a single member', async function () {
      const tx = await c.GovernanceProxy.dismissMembers([members[0]]);
      receipt = await tx.wait();
    });

    it('lists remaining members', async function () {
      _sortedDeepEqual(await c.GovernanceProxy.getCouncilMembers(), members.slice(1));

      await assertEvent(receipt, `CouncilMemberRemoved("${members[0]}", 0)`, c.GovernanceProxy);
      await assertEvent(
        receipt,
        `CouncilMembersDismissed(["${members[0]}"], 0)`,
        c.GovernanceProxy
      );
    });

    it('did not start an emergency election', function () {
      const emergencyEvents = receipt.events?.filter(
        (evt) => evt.event === 'EmergencyElectionStarted'
      );
      deepEqual(emergencyEvents, []);
    });

    describe('when dismissing all members', function () {
      let membersToDissmiss: string[];
      let receipt: ethers.ContractReceipt;

      before('dismiss remaining members', async function () {
        [, ...membersToDissmiss] = members;
        const tx = await c.GovernanceProxy.dismissMembers(membersToDissmiss);
        receipt = await tx.wait();
      });

      it('lists remaining members', async function () {
        _sortedDeepEqual(await c.GovernanceProxy.getCouncilMembers(), []);

        await Promise.all(
          membersToDissmiss.map((m) =>
            assertEvent(receipt, `CouncilMemberRemoved("${m}", 0)`, c.GovernanceProxy)
          )
        );
        await assertEvent(
          receipt,
          `CouncilMembersDismissed(["${membersToDissmiss.join('", "')}"], 0)`,
          c.GovernanceProxy
        );
      });

      it('triggered emergency election', async function () {
        await assertEvent(receipt, `EmergencyElectionStarted(0)`, c.GovernanceProxy);
      });

      it('jump to nomination period', async function () {
        assertBn.equal(await c.GovernanceProxy.getCurrentPeriod(), ElectionPeriod.Nomination);
      });
    });
  });
});
