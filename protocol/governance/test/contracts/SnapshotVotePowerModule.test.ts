import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import { bootstrap } from '../bootstrap';

import assert from 'assert/strict';

describe('SnapshotVotePowerModule', function () {
  const { c, getSigners } = bootstrap();

  let owner: ethers.Signer;
  let user: ethers.Signer;

  const { CoreProxy, SnapshotRecordMock } = c;
  before('identify signers', function () {
    [owner, user] = getSigners();
  });

  describe('#setSnapshotContract', function () {
    it('should revert when not owner', async function () {
      await assertRevert(
        CoreProxy.connect(user).setSnapshotContract(SnapshotRecordMock.address, true)
      );
    });
    it('should set snapshot contract', async function () {
      await CoreProxy.setSnapshotContract(SnapshotRecordMock.address, true);
      // shouldn't be valid for current epoch
      assert(await CoreProxy.isSnapshotVotePowerValid(SnapshotRecordMock.address, 0), false);
      // should be valid for next epoch
      assert(await CoreProxy.isSnapshotVotePowerValid(SnapshotRecordMock.address, 1), true);
    });

    it('should allow for snapshot contracts to be removed on the next epoch', async function () {
      await CoreProxy.setSnapshotContract(SnapshotRecordMock.address, true);
      // manually advance the epoch
      await CoreProxy.Council_set_lastElectionId(1);
      await CoreProxy.setSnapshotContract(SnapshotRecordMock.address, false);
      // should still be valid for this epoch
      assert(await CoreProxy.isSnapshotVotePowerValid(SnapshotRecordMock.address, 1), true);
      // should not be valid for next epoch
      assert(await CoreProxy.isSnapshotVotePowerValid(SnapshotRecordMock.address, 2), false);
    });
  });

  describe('#takeVotePowerSnapshot', function () {
    before('set snapshot contract', async function () {
      await CoreProxy.setSnapshotContract(SnapshotRecordMock.address, true);
      await CoreProxy.Council_set_lastElectionId(1);
    });

    it('should revert when not correct epoch phase', async function () {
      await assertRevert(CoreProxy.takeVotePowerSnapshot(SnapshotRecordMock.address));
    });

    it('should take vote power snapshot', async function () {
      await CoreProxy.setSnapshotContract(SnapshotRecordMock.address, true);
      await CoreProxy.takeVotePowerSnapshot(SnapshotRecordMock.address);
      assert(await CoreProxy.isSnapshotVotePowerValid(SnapshotRecordMock.address, 1), true);
    });
  });
});
