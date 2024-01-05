import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { ethers } from 'ethers';
import { bootstrap } from '../../bootstrap';
import assert from 'assert';

describe('ElectionModule - voting', function () {
  const { c, getSigners, getProvider } = bootstrap();

  let user: ethers.Signer;
  let otherUser: ethers.Signer;

  before('identify signers', async function () {
    [, user, otherUser] = getSigners();
  });

  before('create voting power for user', async function () {
    await c.CoreProxy.Ballot_set_votingPower(
      await c.CoreProxy.Council_get_currentElectionId(),
      await user.getAddress(),
      13370,
      100
    );
  });

  describe('#cast', function () {
    it('reverts if not in the voting period', async function () {
      await assertRevert(
        c.CoreProxy.connect(user).cast([await user.getAddress()], [1]),
        'NotCallableInCurrentPeriod()',
        c.CoreProxy
      );
    });

    describe('when in the voting period', function () {
      before('fast forward', async function () {
        const schedule = await c.CoreProxy.getEpochSchedule();
        await fastForwardTo(Number(schedule.votingPeriodStartDate), getProvider());
      });

      it('reverts if ballot has too many candidates', async function () {
        const candidates = [
          ethers.Wallet.createRandom().address,
          ethers.Wallet.createRandom().address,
        ];

        await assertRevert(
          c.CoreProxy.connect(user).cast(candidates, [1, 1]),
          'InvalidParameter("candidates", "too many candidates")',
          c.CoreProxy
        );
      });

      it('reverts if voting power does not exist', async function () {
        const sender = await otherUser.getAddress();
        await assertRevert(
          c.CoreProxy.connect(otherUser).cast([sender], [0]),
          `NoVotingPower("${sender}", "${await c.CoreProxy.getEpochIndex()}")`,
          c.CoreProxy
        );
      });

      describe('when the user is nominated', async function () {
        before('nominate user', async function () {
          await c.CoreProxy.connect(user).nominate();
        });

        it('reverts if ballot voting power does not match', async function () {
          await assertRevert(
            c.CoreProxy.connect(user).cast([await user.getAddress()], [1]),
            'InvalidBallot()',
            c.CoreProxy
          );
        });

        it('succeeds if ballot voting power matches', async function () {
          await c.CoreProxy.connect(user).cast([await user.getAddress()], [100]);
        });

        it('succeeds if user withdraws his own vote', async () => {
          await c.CoreProxy.connect(user).withdrawVote([await user.getAddress()]);
          assert.equal(
            await c.CoreProxy.connect(user).hasVoted(
              await user.getAddress(),
              (await user.provider!.getNetwork()).chainId
            ),
            false
          );
        });
      });
    });
  });
});
