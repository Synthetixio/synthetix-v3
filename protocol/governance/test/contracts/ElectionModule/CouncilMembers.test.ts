import { deepEqual, equal } from 'node:assert/strict';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { ethers } from 'ethers';
import { bootstrap } from '../../bootstrap';

describe('ElectionModule - council members', function () {
  const { c, getSigners, snapshotCheckpoint } = bootstrap();

  let owner: ethers.Signer;
  let members: ethers.Signer[];

  before('identify signers', async function () {
    owner = getSigners()[0];
    members = getSigners().slice(1, 4);
  });

  before('register emitters', async function () {
    await c.GovernanceProxy.connect(owner).setRegisteredEmitters(
      [10002],
      [c.GovernanceProxy.address]
    );
  });

  before('prepare council members', async function () {
    const membersToAdd = await Promise.all(members.map((m) => m.getAddress()));
    await c.GovernanceProxy.removeAllCouncilMembersMock(0);
    await c.GovernanceProxy.addCouncilMembersMock(membersToAdd, 0);
  });

  it('correctly shows all members', async function () {
    const expected = await Promise.all(members.map((m) => m.getAddress()));
    const current = await c.GovernanceProxy.getCouncilMembers();
    deepEqual(expected, current);
  });

  describe('#dismissMembers', function () {
    snapshotCheckpoint();
  });
});
