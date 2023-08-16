import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { ethers } from 'ethers';
import { bootstrap } from '../../bootstrap';

describe('ElectionModule - voting', () => {
  const { c, getSigners, getProvider } = bootstrap();

  let user: ethers.Signer, otherUser: ethers.Signer;

  before('identify signers', async () => {
    [, user, otherUser] = getSigners();
  });

  before('set mothership', async () => {
    await c.CoreProxy.configureMothership(13370);
  });

  before('create voting power for user', async () => {
    await c.CoreProxy.Ballot_set_votingPower(
      await c.CoreProxy.Council_get_currentElectionId(),
      await user.getAddress(),
      13370,
      100
    );
  });

  describe('#cast', () => {
    it('reverts if not in the voting period', async () => {
      await assertRevert(
        c.CoreProxy.connect(user).cast([await user.getAddress()], [1]),
        'NotCallableInCurrentPeriod()',
        c.CoreProxy
      );
    });

    describe('when in the voting period', () => {
      before('fast forward', async () => {
        const schedule = await c.CoreProxy.getEpochSchedule();
        await fastForwardTo(Number(schedule.votingPeriodStartDate), getProvider());
      });

      it('reverts if voting power does not exist', async () => {
        await assertRevert(
          c.CoreProxy.connect(user).cast([await otherUser.getAddress()], [0]),
          'InvalidParameter("amounts"',
          c.CoreProxy
        );
      });

      it('reverts if ballot voting power does not match', async () => {
        await assertRevert(
          c.CoreProxy.connect(user).cast([await user.getAddress()], [1]),
          'InvalidParameter("amounts"',
          c.CoreProxy
        );
      });

      // TODO: unskip this test once nominees api is cleaned up
      it.skip('succeeds if ballot voting power matches', async () => {
        await c.CoreProxy.connect(user).cast([await user.getAddress()], [100]);
      });
    });
  });
});
